import { UserPayload } from "@libs/contracts";
import { createParamDecorator, ExecutionContext } from "@nestjs/common";


export const CurrentUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserPayload | undefined;
    if (!user) {
      return undefined;
    }
    
    // если было указано поле - вернуть только его
    if (data) {
      return user[data];
    }

    return user;
  }
)