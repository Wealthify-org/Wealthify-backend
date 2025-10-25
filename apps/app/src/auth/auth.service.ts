import { HttpStatus, Injectable} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from  '@app/contracts';
import { UsersService } from '@app/users/users.service';
import * as bcrypt from 'bcryptjs'
import { InjectModel } from '@nestjs/sequelize';
import { RefreshToken } from './refresh-token.model';
import { ResetToken } from './reset-token-model';
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize';
import { ChangePasswordDto } from  '@app/contracts';
import { ForgotPasswordDto } from  '@app/contracts';
import { MailService } from '@app/common/services/mail.service';
import { ResetPasswordDto } from  '@app/contracts';
import { LoginDto } from  '@app/contracts';
import { UserPayload } from  '@app/contracts/common/types/user-payload.type';
import { User } from '@app/users/users.model';
import { rpcError } from '@app/contracts/common/rpc/rpc-error';

@Injectable()
export class AuthService {
  private readonly hashComplexity: number = 10

  constructor (
    private userService: UsersService, 
    private jwtService: JwtService,
    private mailService: MailService,
    @InjectModel(RefreshToken) private refreshTokenRepository: typeof RefreshToken,
    @InjectModel(ResetToken) private resetTokenRepository: typeof ResetToken
  ) {}

  async registration(userDto: CreateUserDto) {
    const [candidateByEmail, candidateByUsername] = await Promise.all([
      this.userService.getUserByEmail(userDto.email),
      this.userService.getUserByUsername(userDto.username)
    ]);

    if (candidateByEmail) {
      rpcError(HttpStatus.BAD_REQUEST, 'USER_EXISTS', 'User with such email already exists');
    }
    if (candidateByUsername) {
      rpcError(HttpStatus.BAD_REQUEST, 'USER_EXISTS', 'User with such username already exists');
    }
    const hashPassword = await bcrypt.hash(userDto.password, this.hashComplexity)
    const user = await this.userService.createUser({...userDto, password: hashPassword})
    const tokens = await this.generateUserTokens(user)
    return { ...tokens, user: this.safeUser(user)}
  }

  async login(userDto: LoginDto) {
    const user = await this.validateUser(userDto)
    if (!user) {
      rpcError(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", 'Incorrect email or password');
    }
    const tokens = await this.generateUserTokens(user)
    return { ...tokens, user: this.safeUser(user)}
  }

  async refreshTokens(refreshTokenPlain?: string) {
    if (!refreshTokenPlain) {
      rpcError(HttpStatus.UNAUTHORIZED, 'NO_REFRESH', 'No refresh token');
    }

    const rows = await this.refreshTokenRepository.findAll({
      where: {
        expiryDate: { [Op.gte]: new Date() },
      },
    })

    let matched: RefreshToken | undefined
    for (const row of rows) {
      if (await bcrypt.compare(refreshTokenPlain, row.dataValues.token)) {
        matched = row;
        break;
      }
    }

    if (!matched) {
      rpcError(HttpStatus.UNAUTHORIZED, 'INVALID_REFRESH', 'Refresh token is invalid');
    }

    const user = await this.userService.getUserById(matched.dataValues.userId)
    if (!user) {
      rpcError(HttpStatus.INTERNAL_SERVER_ERROR, 'USER_NOT_FOUND', 'User not found');
    }

    await matched.destroy()

    const tokens = await this.generateUserTokens(user)
    return { ...tokens, user: this.safeUser(user) }
  }

  async revokeRefreshToken(refreshTokenPlain: string) {
    const rows = await this.refreshTokenRepository.findAll({
      where: {
        expiryDate: { [Op.gte]: new Date() },
      },
    })

    for (const row of rows) {
      if (await bcrypt.compare(refreshTokenPlain, row.dataValues.token)) {
        await row.destroy()
        return;
      }
    }
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto
    const user = await this.userService.getUserById(userId)
    if (!user) {
      rpcError(HttpStatus.NOT_FOUND, 'USER_NOT_FOUND', 'User not found');
    }

    const passwordMatch = await bcrypt.compare(oldPassword, user.dataValues.password)
    if (!passwordMatch) {
      rpcError(HttpStatus.UNAUTHORIZED, 'BAD_CREDENTIALS', 'Wrong credentials');
    }

    const newHashedPassword = await bcrypt.hash(newPassword, this.hashComplexity)
    user.password = newHashedPassword
    await user.save()
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto
    const user = await this.userService.getUserByEmail(email)

    if (user) {
      const expiryDate = new Date()
      expiryDate.setHours(expiryDate.getHours() + 1)

      const resetToken = uuidv4()
      const hashedResetToken = await bcrypt.hash(resetToken, this.hashComplexity)

      await this.resetTokenRepository.upsert({
        userId: user.dataValues.id,
        token: hashedResetToken, 
        expiryDate
      })

      this.mailService.sendPasswordResetEmail(email, resetToken)
    }

    return { message: "If the user exists, they will receive an email"}
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { resetToken, newPassword, userId } = resetPasswordDto
    const tokenRow = await this.resetTokenRepository.findOne({
      where: {
        userId,
        expiryDate: {
          [Op.gte]: new Date()
        }
      }
    })

    if (!tokenRow) {
      rpcError(HttpStatus.UNAUTHORIZED, 'INVALID_LINK', 'Invalid link');
    }

    const isTokensEqual = await bcrypt.compare(resetToken, tokenRow.dataValues.token)
    if (!isTokensEqual) {
      rpcError(HttpStatus.UNAUTHORIZED, 'INVALID_LINK', 'Invalid link');
    }

    const user = await this.userService.getUserById(tokenRow.dataValues.userId)
    if (!user) {
      rpcError(HttpStatus.INTERNAL_SERVER_ERROR, 'USER_NOT_FOUND', 'User not found');
    }

    user.password = await bcrypt.hash(newPassword, this.hashComplexity) 
    await user.save()

    await tokenRow.destroy()
  }

  private async generateUserTokens(user: User) {
    const payload: UserPayload = {
      id: user.dataValues.id,
      email: user.dataValues.email,
      roles: user.dataValues.roles
    }
    const accessToken = this.jwtService.sign( payload, { expiresIn: '15m' })
    const refreshToken = uuidv4()

    const hashedRefreshToken = await bcrypt.hash(refreshToken, this.hashComplexity)

    await this.storeRefreshToken(hashedRefreshToken, user.dataValues.id)

    return {
      accessToken,
      refreshToken
    }
  }

  private async storeRefreshToken(token: string, userId: number) {
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 3)

    await this.refreshTokenRepository.upsert({
      token, 
      userId,
      expiryDate
    })
  }

  private async validateUser(userDto: LoginDto) {
    const user = await this.userService.getUserByEmail(userDto.email)

    if (!user) {
      return undefined
    }

    const passwordEquals = await bcrypt.compare(userDto.password, user.password)
    if (passwordEquals) {
      return user
    }
  }

  private safeUser(user: User) {
    const raw = (user as any).toJSON?.() ?? (user as any).dataValues ?? user
    const { password, ...rest } = raw
    return rest
  }
}
