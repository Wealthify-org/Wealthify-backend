"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginDto = exports.LoginSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
const password_constants_1 = require("../../common/validation/password.constants");
exports.LoginSchema = zod_1.z
    .object({
    email: zod_1.z
        .string()
        .transform((v) => String(v).trim().toLowerCase())
        .pipe(zod_1.z.string().email('Invalid email address'))
        .describe('Почта пользователя'),
    password: zod_1.z
        .string()
        .min(12, 'Password must be at least 12 characters long')
        .max(72, 'Password must be at most 72 characters long')
        .regex(password_constants_1.ONLY_ALLOWED_CHARS, `Use letters, digits and only: ${password_constants_1.ALLOWED_SYMBOLS}`)
        .regex(/[a-z]/, 'Must include a lowercase letter')
        .regex(/[A-Z]/, 'Must include an uppercase letter')
        .regex(/\d/, 'Must include a number')
        .regex(password_constants_1.HAS_ALLOWED_SYMBOL, `Must include at least one of: ${password_constants_1.ALLOWED_SYMBOLS}`)
        .describe('Пароль пользователя'),
})
    .strict();
class LoginDto extends (0, nestjs_zod_1.createZodDto)(exports.LoginSchema) {
}
exports.LoginDto = LoginDto;
