"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgotPasswordDto = exports.ForgotPasswordSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.ForgotPasswordSchema = zod_1.z
    .object({
    email: zod_1.z.string().email().describe('Почта пользователя'),
})
    .strict();
class ForgotPasswordDto extends (0, nestjs_zod_1.createZodDto)(exports.ForgotPasswordSchema) {
}
exports.ForgotPasswordDto = ForgotPasswordDto;
