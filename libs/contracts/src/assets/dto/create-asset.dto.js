"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateAssetDto = exports.CreateAssetSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
const asset_type_enum_1 = require("../../common/enums/asset-type.enum");
exports.CreateAssetSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1, 'name is required').describe('Название актива'),
    ticker: zod_1.z.string().min(1, 'ticker is required').describe('Тикер актива'),
    type: zod_1.z
        .nativeEnum(asset_type_enum_1.AssetType)
        .describe('Тип актива: Crypto (криптовалюты), Stock (акции), Bond (облигации), Fiat (фиатные деньги)'),
})
    .strict();
class CreateAssetDto extends (0, nestjs_zod_1.createZodDto)(exports.CreateAssetSchema) {
}
exports.CreateAssetDto = CreateAssetDto;
