import { Body, Controller, Delete, Get, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  FavoriteAssetDto,
  FavoriteIdsResponseDto,
  IsFavoriteResponseDto,
  OkResponseDto,
  ToggleFavoriteResponseDto,
} from "@libs/contracts";

import { JwtAuthGuard } from "@gateway/common/guards/jwt-auth.guard";
import { CurrentUser } from "@gateway/common/decorators/сurrent-user.decorator";
import { FavoritesService } from "./favorites.service";

@ApiTags("Избранное")
@Controller("favorites")
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get("ids")
  @ApiOperation({ summary: "Получить список assetId в избранном" })
  @ApiResponse({ status: HttpStatus.OK, type: FavoriteIdsResponseDto })
  listIds(@CurrentUser("id") userId: number) {
    return this.favorites.listIds(userId);
  }

  @Post("toggle")
  @ApiOperation({ summary: "Переключить избранное для актива" })
  @ApiBody({
    schema: {
      properties: {
        assetId: { type: "number", example: 42 },
      },
      required: ["assetId"],
    },
  })
  @ApiResponse({ status: HttpStatus.OK, type: ToggleFavoriteResponseDto })
  toggle(@CurrentUser("id") userId: number, @Body() body: { assetId: number }) {
    const dto: FavoriteAssetDto = {
      userId,
      assetId: body.assetId,
    };

    return this.favorites.toggle(dto);
  }

  @Post()
  @ApiOperation({ summary: "Добавить актив в избранное" })
  @ApiBody({
    schema: {
      properties: {
        assetId: { type: "number", example: 42 },
      },
      required: ["assetId"],
    },
  })
  @ApiResponse({ status: HttpStatus.OK, type: OkResponseDto })
  add(@CurrentUser("id") userId: number, @Body() body: { assetId: number }) {
    const dto: FavoriteAssetDto = {
      userId,
      assetId: body.assetId,
    };

    return this.favorites.add(dto);
  }

  @Delete(":assetId")
  @ApiOperation({ summary: "Удалить актив из избранного" })
  @ApiResponse({ status: HttpStatus.OK, type: OkResponseDto })
  remove(@CurrentUser("id") userId: number, @Param("assetId") assetId: string) {
    const dto: FavoriteAssetDto = {
      userId,
      assetId: Number(assetId),
    };

    return this.favorites.remove(dto);
  }

  @Get(":assetId")
  @ApiOperation({ summary: "Проверить, в избранном ли актив" })
  @ApiResponse({ status: HttpStatus.OK, type: IsFavoriteResponseDto })
  isFavorite(@CurrentUser("id") userId: number, @Param("assetId") assetId: string) {
    const dto: FavoriteAssetDto = {
      userId,
      assetId: Number(assetId),
    };

    return this.favorites.isFavorite(dto);
  }
}
