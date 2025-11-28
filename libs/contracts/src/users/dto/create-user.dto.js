"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUserDto = exports.CreateUserSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
const password_constants_1 = require("./../../common/validation/password.constants");
exports.CreateUserSchema = zod_1.z
    .object({
    username: zod_1.z
        .string()
        .min(3, 'Username must be 3-30 characters')
        .max(30, 'Username must be 3-30 characters')
        .regex(/^[A-Za-z][A-Za-z0-9_.-]*$/, "Use letters, digits, '_', '.', '-' (must start with a letter)")
        .regex(/[A-Za-z0-9]$/, "Cannot end with '_', '.' or '-'")
        .regex(/^(?!.*[_.-]{2,}).*$/, 'No consecutive special characters')
        .regex(/(?!^\d+$)^.+$/, 'Username cannot be only digits')
        .describe('Никнейм пользователя'),
    email: zod_1.z
        .string()
        .transform((v) => String(v).trim().toLowerCase())
        .pipe(zod_1.z.string().email('Invalid email address'))
        .describe('Почта пользователя'),
    password: zod_1.z
        .string()
        .min(12, 'Password must be at least 12 characters')
        .max(72, 'Password must be at most 72 characters')
        .regex(password_constants_1.ONLY_ALLOWED_CHARS, `Use letters, digits and only these symbols: ${password_constants_1.ALLOWED_SYMBOLS}`)
        .regex(/[a-z]/, 'Must include a lowercase letter')
        .regex(/[A-Z]/, 'Must include an uppercase letter')
        .regex(/\d/, 'Must include a number')
        .regex(password_constants_1.HAS_ALLOWED_SYMBOL, `Must include at least one of: ${password_constants_1.ALLOWED_SYMBOLS}`)
        .describe('Пароль пользователя'),
})
    .strict();
class CreateUserDto extends (0, nestjs_zod_1.createZodDto)(exports.CreateUserSchema) {
}
exports.CreateUserDto = CreateUserDto;
