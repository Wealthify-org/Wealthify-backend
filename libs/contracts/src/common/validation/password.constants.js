"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ONLY_ALLOWED_CHARS = exports.HAS_ALLOWED_SYMBOL = exports.ALLOWED_SYMBOLS = void 0;
exports.ALLOWED_SYMBOLS = `!@#$%^&*()_-=,./?\\|~`;
const escapeForCharClass = (s) => s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");
const specialsClass = escapeForCharClass(exports.ALLOWED_SYMBOLS);
exports.HAS_ALLOWED_SYMBOL = new RegExp(`[${specialsClass}]`);
exports.ONLY_ALLOWED_CHARS = new RegExp(`^[A-Za-z0-9${specialsClass}]+$`);
