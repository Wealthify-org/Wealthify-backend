import { UserPayload } from "@libs/contracts";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly log = new Logger(JwtAuthGuard.name);

  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers?.authorization;

    // Без заголовка — сразу 401, без попыток `.split` на undefined.
    if (!authHeader || typeof authHeader !== "string") {
      throw new UnauthorizedException({ message: "User is not authorized" });
    }

    const [bearer, token] = authHeader.split(" ");
    if (bearer !== "Bearer" || !token) {
      throw new UnauthorizedException({ message: "User is not authorized" });
    }

    try {
      const payload = this.jwtService.verify<UserPayload>(token);
      req.user = payload;
      req.userId = payload.id;
      return true;
    } catch (e) {
      // Логируем подробности, пользователю — общее сообщение (без `${e}`,
      // чтобы не утекали внутренние детали JWT).
      this.log.debug(`JWT verify failed: ${(e as Error)?.message ?? e}`);
      throw new UnauthorizedException({ message: "User is not authorized" });
    }
  }
}
