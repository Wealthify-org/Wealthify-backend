import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';
import { TimeoutError } from 'rxjs';
import { MsError } from './ms-error.type';
import { RpcErr } from './rpc-error.type';

const log = new Logger('RpcClient');

export async function sendOrThrow<T = any>(
  client: ClientProxy,
  pattern: string,
  payload: any,
  ms = 5000,
): Promise<T> {
  try {
    return await firstValueFrom(
      client.send<T, any>(pattern, payload).pipe(
        timeout(ms),
        catchError((err: RpcErr) => {
          const obj: MsError = err
          const status =
            (typeof obj.status === 'number' && obj.status >= 400 && obj.status <= 599)
              ? obj.status
              : HttpStatus.BAD_GATEWAY;

          const body = {
            code: obj.code ?? 'BAD_GATEWAY',
            message: obj.message ?? 'Bad Gateway',
          };
          
          return throwError(() => new HttpException(body, status));
        }),
      ),
    );
  } catch (e: any) {
    if (e instanceof TimeoutError) {
      log.error(`Upstream timeout [${pattern}] after ${ms}ms`);
      throw new HttpException({ code: 'UPSTREAM_TIMEOUT', message: 'Upstream timeout' }, HttpStatus.GATEWAY_TIMEOUT);
    }
    if (e?.code === 'ECONNREFUSED') {
      log.error(`Upstream connection refused [${pattern}]`);
      throw new HttpException({ code: 'UPSTREAM_UNAVAILABLE', message: 'Upstream unavailable' }, HttpStatus.BAD_GATEWAY);
    }
    throw e; // уже HttpException из catchError
  }
}
