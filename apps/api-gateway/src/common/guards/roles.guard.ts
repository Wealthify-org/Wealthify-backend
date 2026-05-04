import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ROLES_KEY } from "../decorators/roles-auth.decorator";
import { UserPayload } from "@libs/contracts/common/types/user-payload.type";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly log = new Logger(RolesGuard.name);

  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers?.authorization;
    if (!authHeader || typeof authHeader !== "string") {
      throw new UnauthorizedException({ message: "User is not authorized" });
    }

    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer" || !token) {
      throw new UnauthorizedException({ message: "User is not authorized" });
    }

    let payload: UserPayload;
    try {
      payload = this.jwtService.verify<UserPayload>(token);
    } catch (e) {
      this.log.debug(`JWT verify failed: ${(e as Error)?.message ?? e}`);
      throw new UnauthorizedException({ message: "User is not authorized" });
    }

    // Раньше было `req.user = payload.id` — затирало объект, поставленный
    // JwtAuthGuard'ом, и `@CurrentUser('id')` после Roles-guard'а получал
    // undefined. Сохраняем full-payload, чтобы поведение было одинаковым
    // независимо от порядка guards.
    req.user = payload;
    req.userId = payload.id;

    const hasRole = (payload.roles ?? []).some((role) =>
      requiredRoles.includes(role.value),
    );
    if (!hasRole) {
      throw new ForbiddenException({
        message: "Access denied: insufficient role",
      });
    }
    return true;
  }
}
