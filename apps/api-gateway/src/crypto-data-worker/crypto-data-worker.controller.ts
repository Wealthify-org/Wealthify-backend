import { Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CryptoDataWorkerService } from "./crypto-data-worker.service";

@ApiTags('Crypto Data Worker')
@Controller('crypto-data-worker')
export class CryptoDataWorkerController {
  constructor(private readonly cryptoDataWorkerService: CryptoDataWorkerService) {}
  @ApiOperation({ summary: 'Проверка воркера' })
  @ApiResponse({ status: HttpStatus.OK, description: 'OK' })
  @Get('health')
  health() {
    return this.cryptoDataWorkerService.health();
  }
}