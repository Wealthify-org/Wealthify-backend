import { Response } from 'express'

export const ACCESS_TOKEN_COOKIE = 'access_token'
export const REFRESH_TOKEN_COOKIE = 'refresh_token'

const isProd = process.env.NODE_ENV === 'production'

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000
  })

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true, 
    secure: isProd,
    sameSite: 'lax',
    path: '/auth',
    maxAge: 3 * 24 * 60 * 60 * 1000,
  })
}

export const clearAuthCookies = (res: Response) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, {path: '/'})
  res.clearCookie(REFRESH_TOKEN_COOKIE, {path: '/auth'})
}