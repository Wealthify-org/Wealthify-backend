"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SellAssetDto = exports.SellAssetSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.SellAssetSchema = zod_1.z
    .object({
    portfolioId: zod_1.z
        .coerce.number()
        .int()
        .describe('ID портфеля, в котором продаётся актив'),
    assetTicker: zod_1.z
        .string()
        .min(1, 'assetTicker is required')
        .describe('Тикер продаваемого актива'),
    quantity: zod_1.z
        .coerce.number()
        .describe('Количество продаваемого актива'),
    convertToUsd: zod_1.z
        .coerce.boolean()
        .optional()
        .describe('Нужно ли конвертировать выручку от продажи в доллары (добавить USD в портфель)'),
    pricePerUnit: zod_1.z
        .coerce.number()
        .describe('Цена за одну единицу актива в момент продажи (в USD)'),
})
    .strict();
class SellAssetDto extends (0, nestjs_zod_1.createZodDto)(exports.SellAssetSchema) {
}
exports.SellAssetDto = SellAssetDto;
