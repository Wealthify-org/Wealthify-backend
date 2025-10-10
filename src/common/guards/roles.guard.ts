import { CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { Observable } from "rxjs";
import { ROLES_KEY } from "../decorators/roles-auth.decorator";
import { User } from "src/users/users.model";
import { UserPayload } from "../types/user-payload.type";
import { Request } from "express";
import { ACCESS_TOKEN_COOKIE } from "src/auth/cookie.const";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    
    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const req = context.switchToHttp().getRequest<Request>()

    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

    if (!token) { 
      throw new UnauthorizedException('User is unauthorized'); 
    }

    let payload: UserPayload;
    try {
      payload = this.jwtService.verify<UserPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    (req as any).user = payload;
    (req as any).userId = (payload as any)?.id ?? (payload as any)?.userId;

    const userRoles = normalizeRoles((payload as any).roles);
    const allowed = userRoles.some((r) => requiredRoles.includes(r));
    if (!allowed) {
      throw new ForbiddenException('Insufficient role');
    }

    return true;
  }
}

function normalizeRoles(roles: any): string[] {
  if (!roles) return [];
  if (Array.isArray(roles) && roles.every((x) => typeof x === 'string')) return roles;
  if (Array.isArray(roles)) {
    return roles.map((r) => (typeof r === 'string' ? r : r?.value)).filter(Boolean);
  }
  if (roles && typeof roles === 'object' && 'value' in roles) return [roles.value];
  return [];
}