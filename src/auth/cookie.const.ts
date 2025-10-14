import { Response } from 'express'

export const REFRESH_TOKEN_COOKIE = 'refresh_token'

const isProd = process.env.NODE_ENV === 'production'

export const setAuthCookies = (
  res: Response,
  refreshToken: string,
) => {

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true, 
    secure: isProd,
    sameSite: 'lax',
    path: '/auth',
    maxAge: 3 * 24 * 60 * 60 * 1000,
  })
}

export const clearAuthCookies = (res: Response) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {path: '/auth'})
}