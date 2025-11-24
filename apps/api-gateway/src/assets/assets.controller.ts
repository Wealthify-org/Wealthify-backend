import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AssetsService } from './assets.service';

import {
  CreateAssetDto,
} from '@libs/contracts';

import { JwtAuthGuard } from '@gateway/common/guards/jwt-auth.guard';
import { RolesGuard } from '@gateway/common/guards/roles.guard';
import { Roles } from '@gateway/common/decorators/roles-auth.decorator';

@ApiTags('Активы')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post()
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Создание нового актива' })
  @ApiResponse({ status: 201, description: 'Актив успешно создан' })
  @ApiResponse({ status: 400, description: 'Актив с таким тикером уже существует' })
  @ApiBody({ type: CreateAssetDto })
  create(@Body() dto: CreateAssetDto) {
    return this.assets.createAsset(dto);
  }

  @Get(':ticker')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Получить актив по тикеру' })
  @ApiResponse({ status: 200, description: 'Актив найден' })
  @ApiResponse({ status: 404, description: 'Актив не найден' })
  @ApiParam({ name: 'ticker', description: 'Тикер актива (например, BTC)' })
  getByTicker(@Param('ticker') ticker: string) {
    return this.assets.getAssetByTicker(ticker);
  }

  @Delete(':ticker')
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Удалить актив по тикеру' })
  @ApiResponse({ status: 200, description: 'Актив и все связанные записи успешно удалены' })
  @ApiResponse({ status: 404, description: 'Актив не найден' })
  @ApiParam({ name: 'ticker', description: 'Тикер удаляемого актива' })
  deleteAsset(@Param('ticker') ticker: string) {
    return this.assets.deleteAssetByTicker(ticker);
  }
}