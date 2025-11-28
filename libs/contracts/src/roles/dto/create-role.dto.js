"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRoleDto = exports.CreateRoleSchema = void 0;
const zod_1 = require("zod");
const nestjs_zod_1 = require("nestjs-zod");
exports.CreateRoleSchema = zod_1.z
    .object({
    value: zod_1.z.string().min(1, 'value is required').describe('Название роли пользователя'),
    description: zod_1.z.string().min(1, 'description is required').describe('Описание роли пользователя'),
})
    .strict();
class CreateRoleDto extends (0, nestjs_zod_1.createZodDto)(exports.CreateRoleSchema) {
}
exports.CreateRoleDto = CreateRoleDto;
