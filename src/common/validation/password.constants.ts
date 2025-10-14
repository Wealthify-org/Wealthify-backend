// разрешённые спецсимволы
export const ALLOWED_SYMBOLS = `!@#$%^&*()_-=,./?\\|~`;

// экранируем для символьного класса
const escapeForCharClass = (s: string) =>
  s.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&");

const specialsClass = escapeForCharClass(ALLOWED_SYMBOLS);

// есть хотя бы один разрешённый спецсимвол
export const HAS_ALLOWED_SYMBOL = new RegExp(`[${specialsClass}]`);

// только латиница/цифры и разрешённые спецсимволы 
export const ONLY_ALLOWED_CHARS = new RegExp(`^[A-Za-z0-9${specialsClass}]+$`);
