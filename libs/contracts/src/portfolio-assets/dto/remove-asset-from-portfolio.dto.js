"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoveAssetFromPortfolioDto = exports.RemoveAssetFromPortfolioSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.RemoveAssetFromPortfolioSchema = zod_1.z
    .object({
    portfolioId: zod_1.z
        .coerce.number()
        .int()
        .describe('ID портфеля, из которого удаляется актив'),
    assetTicker: zod_1.z
        .string()
        .min(1, 'assetTicker is required')
        .describe('Тикер удаляемого актива'),
    removeAllLinkedTransactions: zod_1.z
        .coerce.boolean()
        .describe('Удалять ли все связанные транзакции с этим активом'),
})
    .strict();
class RemoveAssetFromPortfolioDto extends (0, nestjs_zod_1.createZodDto)(exports.RemoveAssetFromPortfolioSchema) {
}
exports.RemoveAssetFromPortfolioDto = RemoveAssetFromPortfolioDto;
