"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePortfolioDto = exports.CreatePortfolioWithoutUserDto = exports.CreatePortfolioWithoutUserSchema = exports.CreatePortfolioSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
const portfolio_type_enum_1 = require("../../common/enums/portfolio-type.enum");
exports.CreatePortfolioSchema = zod_1.z
    .object({
    name: zod_1.z
        .string()
        .min(1, 'name is required')
        .describe('Название портфеля, задаётся пользователем'),
    type: zod_1.z
        .nativeEnum(portfolio_type_enum_1.PortfolioType)
        .describe('Тип портфеля: Crypto, Stock, Bond или Fiat'),
    userId: zod_1.z
        .coerce.number()
        .int()
        .describe('ID пользователя, которому принадлежит портфель'),
})
    .strict();
exports.CreatePortfolioWithoutUserSchema = exports.CreatePortfolioSchema.omit({
    userId: true,
});
class CreatePortfolioWithoutUserDto extends (0, nestjs_zod_1.createZodDto)(exports.CreatePortfolioWithoutUserSchema) {
}
exports.CreatePortfolioWithoutUserDto = CreatePortfolioWithoutUserDto;
class CreatePortfolioDto extends (0, nestjs_zod_1.createZodDto)(exports.CreatePortfolioSchema) {
}
exports.CreatePortfolioDto = CreatePortfolioDto;
