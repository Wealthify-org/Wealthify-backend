"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRoleDto = exports.AddRoleSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.AddRoleSchema = zod_1.z
    .object({
    userId: zod_1.z
        .coerce.number()
        .int()
        .describe('ID пользователя, которому мы добавляем роль'),
    value: zod_1.z
        .string()
        .min(1, 'value is required')
        .describe('Роль, которую мы выдаем'),
})
    .strict();
class AddRoleDto extends (0, nestjs_zod_1.createZodDto)(exports.AddRoleSchema) {
}
exports.AddRoleDto = AddRoleDto;
