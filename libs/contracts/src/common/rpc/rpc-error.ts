import { RpcException } from "@nestjs/microservices";
import { RpcErr } from "./rpc-error.type";


export function rpcError(status: number, code: string, message: string): never {
  throw new RpcException({ status, code, message } satisfies RpcErr);
}
