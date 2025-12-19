import { ApiProperty } from "@nestjs/swagger";

export class FavoriteAssetDto {
  @ApiProperty({ example: 1 })
  userId!: number;

  @ApiProperty({ example: 42 })
  assetId!: number;
}

export class ToggleFavoriteDto extends FavoriteAssetDto {}

export class FavoriteIdsResponseDto {
  @ApiProperty({ example: [1, 2, 3] })
  ids!: number[];
}

export class IsFavoriteResponseDto {
  @ApiProperty({ example: true })
  isFavorite!: boolean;
}

export class ToggleFavoriteResponseDto {
  @ApiProperty({ example: true })
  ok!: true;

  @ApiProperty({ example: true })
  isFavorite!: boolean;
}

export class OkResponseDto {
  @ApiProperty({ example: true })
  ok!: true;
}
