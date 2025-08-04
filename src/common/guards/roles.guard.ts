import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Observable } from "rxjs";
import { ROLES_KEY } from "../decorators/roles-auth.decorator";


export class RolesGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private jwtService: JwtService,
    @Inject(Reflector) private reflector: Reflector
  ) {
    console.log('JwtService:', jwtService);
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    try {
      const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass()
      ])
      
      if (!requiredRoles) {
        return true
      }

      const req = context.switchToHttp().getRequest()
      const authHeader = req.headers.authorization
      const bearer = authHeader.split(' ')[0]
      const token = authHeader.split(' ')[1]
      if (bearer !== 'Bearer' || !token) {
        throw new UnauthorizedException({message: 'User is not authorized'})
      }

      const user = this.jwtService.verify(token)
      req.user = user

      return user.roles.some(role => requiredRoles.includes(role.value))
    } catch (e) {
      throw new HttpException(`No access ${e}`, HttpStatus.FORBIDDEN)
    }
  }
}