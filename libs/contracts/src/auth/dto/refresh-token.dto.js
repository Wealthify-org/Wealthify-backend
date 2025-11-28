"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenDto = exports.RefreshTokenSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.RefreshTokenSchema = zod_1.z
    .object({
    refreshToken: zod_1.z
        .string()
        .min(1, 'refreshToken is required')
        .describe('Рефреш токен пользователя'),
    userId: zod_1.z
        .coerce.number()
        .int()
        .describe('Айди пользователя, которому принадлежит токен'),
})
    .strict();
class RefreshTokenDto extends (0, nestjs_zod_1.createZodDto)(exports.RefreshTokenSchema) {
}
exports.RefreshTokenDto = RefreshTokenDto;
