"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTransactionDto = exports.CreateTransactionSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
const transaction_type_enum_1 = require("../../common/enums/transaction-type.enum");
exports.CreateTransactionSchema = zod_1.z
    .object({
    portfolioId: zod_1.z
        .coerce.number()
        .int()
        .describe('ID портфеля, к которому относится транзакция'),
    assetId: zod_1.z
        .coerce.number()
        .int()
        .describe('ID актива, связанного с транзакцией'),
    type: zod_1.z
        .nativeEnum(transaction_type_enum_1.TransactionType)
        .describe('Тип транзакции: BUY (покупка) или SELL (продажа)'),
    quantity: zod_1.z
        .coerce.number()
        .describe('Количество актива, участвующее в транзакции'),
    pricePerUnit: zod_1.z
        .coerce.number()
        .describe('Цена за единицу актива на момент транзакции (в USD)'),
    date: zod_1.z
        .coerce.date()
        .describe('Дата и время выполнения транзакции'),
})
    .strict();
class CreateTransactionDto extends (0, nestjs_zod_1.createZodDto)(exports.CreateTransactionSchema) {
}
exports.CreateTransactionDto = CreateTransactionDto;
