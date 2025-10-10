import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Observable } from "rxjs";
import { Request } from 'express'
import { ACCESS_TOKEN_COOKIE } from "src/auth/cookie.const";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const req = context.switchToHttp().getRequest<Request>()

    const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];

    if (!cookieToken) {
      throw new UnauthorizedException('No access token')
    }

    try {
      const payload = this.jwtService.verify(cookieToken);
      (req as any).user = payload;
      (req as any).userId = payload?.id

      return true
    } catch (e) {
      throw new UnauthorizedException({message: `User is not authorized: ${e}`})
    }
  }
}