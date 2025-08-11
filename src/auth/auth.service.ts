import { HttpException, HttpStatus, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcryptjs'
import { InjectModel } from '@nestjs/sequelize';
import { RefreshToken } from './refresh-token.model';
import { ResetToken } from './reset-token-model';
import { v4 as uuidv4 } from 'uuid'
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Op } from 'sequelize';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { MailService } from 'src/common/services/mail.service';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private hashComplexity: number = 10

  constructor (
    private userService: UsersService, 
    private jwtService: JwtService,
    private mailService: MailService,
    @InjectModel(RefreshToken) private refreshTokenRepository: typeof RefreshToken,
    @InjectModel(ResetToken) private resetTokenRepository: typeof ResetToken
  ) {}

  async registration(userDto: CreateUserDto) {
    const candidate = await this.userService.getUserByEmail(userDto.email)
    if (candidate) {
      throw new HttpException('User with such email already exists', HttpStatus.BAD_REQUEST)
    }

    const hashPassword = await bcrypt.hash(userDto.password, this.hashComplexity)
    const user = await this.userService.createUser({...userDto, password: hashPassword})
    return this.generateUserTokens(user.dataValues.id)
  }

  async login(userDto: CreateUserDto) {
    const user = await this.validateUser(userDto)
    if (!user) {
      throw new UnauthorizedException({message: 'Incorrect email or password'})
    }

    return this.generateUserTokens(user.dataValues.id)
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    const { refreshToken } = refreshTokenDto

    const token = await this.refreshTokenRepository.findOne({
      where: {
        token: refreshToken, 
        expiryDate: {
          [Op.gte]: new Date()
        }
      }
    })

    if (!token) {
      throw new UnauthorizedException('Refresh token is invalid')
    }

    return await this.generateUserTokens(token.dataValues.userId)
  }

  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto
    const user = await this.userService.getUserById(userId)
    if (!user) {
      throw new NotFoundException('User not found')
    }

    const passwordMatch = await bcrypt.compare(oldPassword, user.dataValues.password)
    if (!passwordMatch) {
      throw new UnauthorizedException('Wrong credentials')
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
      await this.resetTokenRepository.upsert({
        token: resetToken, 
        userId: user.dataValues.id,
        expiryDate
      })

      this.mailService.sendPasswordResetEmail(email, resetToken)
    }

    return { message: "If the user exists, they will receive an email"}
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { resetToken, newPassword } = resetPasswordDto
    const token = await this.resetTokenRepository.findOne({
      where: {
        token: resetToken,
        expiryDate: {
          [Op.gte]: new Date()
        }
      }
    })

    if (!token) {
      throw new UnauthorizedException('Invalid link')
    }

    const user = await this.userService.getUserById(token.dataValues.userId)
    if (!user) {
      throw new InternalServerErrorException()
    }

    user.password = await bcrypt.hash(newPassword, this.hashComplexity) 
    await user.save()

    await token.destroy()
  }

  private async generateUserTokens(userId: number) {
    
    const accessToken = await this.jwtService.sign({ userId }, { expiresIn: '15m' })
    const refreshToken =  uuidv4()
    await this.storeRefreshToken(refreshToken, userId)

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

  private async validateUser(userDto: CreateUserDto) {
    const user = await this.userService.getUserByEmail(userDto.email)

    if (!user) {
      return undefined
    }

    const passwordEquals = await bcrypt.compare(userDto.password, user.password)
    if (passwordEquals) {
      return user
    }
  }
}
