"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordDto = exports.ChangePasswordSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.ChangePasswordSchema = zod_1.z
    .object({
    oldPassword: zod_1.z.string().min(1, 'oldPassword is required').describe('Пароль пользователя, который меняют'),
    newPassword: zod_1.z
        .string()
        .min(6, 'Password must be at least 6 characters long')
        .regex(/\d/, 'Password must contain at least one number')
        .describe('Пароль, на который меняют'),
})
    .strict();
class ChangePasswordDto extends (0, nestjs_zod_1.createZodDto)(exports.ChangePasswordSchema) {
}
exports.ChangePasswordDto = ChangePasswordDto;
