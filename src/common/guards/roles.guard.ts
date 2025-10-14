import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Observable } from "rxjs";
import { ROLES_KEY } from "../decorators/roles-auth.decorator";
import { User } from "src/users/users.model";
import { UserPayload } from "../types/user-payload.type";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector
  ) {}

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

      const payload: UserPayload = this.jwtService.verify(token)
      req.user = payload.id

      return payload.roles.some(role => requiredRoles.includes(role.value))
    } catch (e) {
      throw new HttpException(`No access ${e}`, HttpStatus.FORBIDDEN)
    }
  }
}