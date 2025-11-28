"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddAssetToPortfolioDto = exports.AddAssetToPortfolioSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.AddAssetToPortfolioSchema = zod_1.z
    .object({
    portfolioId: zod_1.z
        .coerce.number()
        .int()
        .describe('Айди портфеля, в который добавляется актив'),
    assetTicker: zod_1.z
        .string()
        .min(1, 'assetTicker is required')
        .describe('Тикер актива, который добавляется в портфель'),
    quantity: zod_1.z
        .coerce.number()
        .describe('Количество единиц актива, который добавляется в портфель'),
    purchasePrice: zod_1.z
        .coerce.number()
        .describe('Цена, по которой актив добавляется в портфель (в USD)'),
})
    .strict();
class AddAssetToPortfolioDto extends (0, nestjs_zod_1.createZodDto)(exports.AddAssetToPortfolioSchema) {
}
exports.AddAssetToPortfolioDto = AddAssetToPortfolioDto;
