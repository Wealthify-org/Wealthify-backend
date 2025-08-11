import { CanActivate, ExecutionContext, Inject, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Observable } from "rxjs";

export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private jwtService: JwtService) {
    console.log(`Jwt service: ${jwtService}`)
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const req = context.switchToHttp().getRequest()
    try {
      const authHeader = req.headers.authorization
      
      const bearer = authHeader.split(' ')[0]
      const token = authHeader.split(' ')[1]
      if (bearer !== 'Bearer' || !token) {
        throw new UnauthorizedException({message: 'User is not authorized'})
      }

      const payload = this.jwtService.verify(token)
      req.userId = payload.id
      return true
    } catch (e) {
      throw new UnauthorizedException({message: `User is not authorized: ${e}`})
    }
  }
}