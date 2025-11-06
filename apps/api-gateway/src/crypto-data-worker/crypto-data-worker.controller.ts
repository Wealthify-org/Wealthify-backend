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

  @ApiOperation({ summary: 'Единичный сбор данных по BTC с CMC' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Задача выполнена' })
  @HttpCode(HttpStatus.OK)
  @Post('collect')
  collectBitcoinOnce() {
    return this.cryptoDataWorkerService.collectOnce();
  }
}