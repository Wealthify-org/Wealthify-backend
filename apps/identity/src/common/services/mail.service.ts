import { Injectable } from '@nestjs/common';
// import * as nodemailer from 'nodemailer'

@Injectable()
export class MailService {
  // private transporter: nodemailer.Transporter 

  constructor() {
    // this.transporter = nodemailer.createTransport({
    //   host: 'smtp.ethereal.email',
    //   port: 587,
    //   auth: {
    //     user: 'kyler57@ethereal.email',
    //     pass: 'WPXtaY1npXhAe161Um'
    //   }
    // });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetLink = `http://yourapp.com/reset-password?token=${token}`
    const mailOptions = {
      from: 'Auth-backend service',
      to: to,
      subject: 'Password Reset Request',
      html: `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${resetLink}">Reset Password</a></p>`
    }

    // await this.transporter.sendMail(mailOptions)
  }
}