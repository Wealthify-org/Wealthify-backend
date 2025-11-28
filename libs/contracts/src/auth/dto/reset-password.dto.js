"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetPasswordDto = exports.ResetPasswordSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.ResetPasswordSchema = zod_1.z
    .object({
    resetToken: zod_1.z
        .string()
        .min(1, 'resetToken is required')
        .describe('Токен для смены пароля пользователем'),
    newPassword: zod_1.z
        .string()
        .min(6, 'Password must be at least 6 characters long')
        .regex(/\d/, 'Password must contain at least one number')
        .describe('Новый пароль пользователя'),
    userId: zod_1.z
        .coerce.number()
        .int()
        .describe('Айди пользователя, которому меняют пароль'),
})
    .strict();
class ResetPasswordDto extends (0, nestjs_zod_1.createZodDto)(exports.ResetPasswordSchema) {
}
exports.ResetPasswordDto = ResetPasswordDto;
