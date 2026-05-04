import { HttpStatus, Injectable} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from  '@libs/contracts';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto';
import { InjectModel } from '@nestjs/sequelize';
import { RefreshToken } from './refresh-token.model';
import { ResetToken } from './reset-token-model';
import { v4 as uuidv4 } from 'uuid'
import { Op } from 'sequelize';
import { ChangePasswordDto } from  '@libs/contracts';
import { ForgotPasswordDto } from  '@libs/contracts';
import { MailService } from '../common/services/mail.service';
import { ResetPasswordDto } from  '@libs/contracts';
import { LoginDto } from  '@libs/contracts';
import { UserPayload } from  '@libs/contracts/common/types/user-payload.type';
import { User } from '../users/users.model';
import { rpcError } from '@libs/contracts/common/rpc/rpc-error';

@Injectable()
export class AuthService {
  private readonly hashComplexity: number = 10

  /**
   * Хешируем refresh/reset-токен через SHA256 (а не bcrypt).
   *
   * Почему: исходный токен — `uuidv4` (~122 бита энтропии), bruteforce
   * против него бессмысленен → нам не нужен медленный bcrypt. SHA256
   * детерминистичен и индексируем — `findOne({where:{token: hash}})`
   * вместо `findAll + bcrypt.compare in loop` (бывшая O(N) на каждый
   * /auth/refresh, который фронт зовёт на каждый page load).
   *
   * Для миграции: уже сохранённые в БД bcrypt-хеши после деплоя не
   * совпадут с новым SHA256 — все активные сессии разлогинятся один раз.
   */
  private hashOpaqueToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

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

    // O(1) lookup по SHA256-хешу — индекс есть на (token) + (expiryDate)
    const hashed = this.hashOpaqueToken(refreshTokenPlain);
    const matched = await this.refreshTokenRepository.findOne({
      where: {
        token: hashed,
        expiryDate: { [Op.gte]: new Date() },
      },
    });

    if (!matched) {
      rpcError(HttpStatus.UNAUTHORIZED, 'INVALID_REFRESH', 'Refresh token is invalid');
    }

    const user = await this.userService.getUserById(matched.dataValues.userId)
    if (!user) {
      // Если юзера удалили после выписки refresh-токена — это известный
      // edge-case, но пользователю должно прилететь 401, а не 500. Иначе
      // фронт показывает generic-ошибку и сессия зависает.
      await matched.destroy().catch(() => {});
      rpcError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_REFRESH',
        'Refresh token belongs to a non-existent user',
      );
    }

    // Сначала генерируем новый токен, потом сносим старый — чтобы при
    // ошибке генерации (JWT-sign) пользователь не остался без сессии.
    const tokens = await this.generateUserTokens(user)
    await matched.destroy().catch(() => {});

    return { ...tokens, user: this.safeUser(user) }
  }

  async authMe(accessToken?: string) {
    if (!accessToken) {
      rpcError(HttpStatus.UNAUTHORIZED, "NO_ACCESS_TOKEN", "No access token");
    }

    try {
      const payload = this.jwtService.verify<UserPayload>(accessToken);

      const user = await this.userService.getUserById(payload.id);
      if (!user) {
        rpcError(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");
      }

      return this.safeUser(user);
    } catch (err) {
      // Не прокидываем `${err}` в сообщение пользователю — может содержать
      // внутренние детали JWT (key id, algorithm). Логируем для отладки.
      // eslint-disable-next-line no-console
      console.warn(
        `[AuthService.authMe] verify failed: ${(err as Error)?.message ?? err}`,
      );
      rpcError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_ACCESS_TOKEN',
        'Access token is invalid or expired',
      );
    }
  }

  async revokeRefreshToken(refreshTokenPlain: string) {
    // O(1) — индексированный delete по SHA256-хешу
    const hashed = this.hashOpaqueToken(refreshTokenPlain);
    await this.refreshTokenRepository.destroy({
      where: { token: hashed },
    });
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
      const hashedResetToken = this.hashOpaqueToken(resetToken)

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
    const hashed = this.hashOpaqueToken(resetToken);
    const tokenRow = await this.resetTokenRepository.findOne({
      where: {
        userId,
        token: hashed,
        expiryDate: {
          [Op.gte]: new Date()
        }
      }
    })

    if (!tokenRow) {
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

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = uuidv4()
    const hashedRefreshToken = this.hashOpaqueToken(refreshToken)

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
