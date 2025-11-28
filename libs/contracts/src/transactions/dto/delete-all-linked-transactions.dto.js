"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteAllLinkedTransactionsDto = exports.DeleteAllLinkedTransactionsSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.DeleteAllLinkedTransactionsSchema = zod_1.z
    .object({
    portfolioId: zod_1.z
        .coerce.number()
        .int()
        .describe('ID портфеля, из которого будут удалены все связанные транзакции'),
    assetId: zod_1.z
        .coerce.number()
        .int()
        .describe('ID актива, по которому будут удалены все связанные транзакции'),
})
    .strict();
class DeleteAllLinkedTransactionsDto extends (0, nestjs_zod_1.createZodDto)(exports.DeleteAllLinkedTransactionsSchema) {
}
exports.DeleteAllLinkedTransactionsDto = DeleteAllLinkedTransactionsDto;
