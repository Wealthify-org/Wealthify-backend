export const PORTFOLIOS_PATTERNS = {
  CREATE: "portfolios.create",
  FIND_ALL_BY_USER: "portfolios.findAllByUser",
  FIND_BY_NAME: "portfolios.findByName",
  FIND_DETAIL_BY_ID: "portfolios.findDetailById",
  DELETE_BY_ID: "portfolios.deleteById",

  USER_SUMMARY: "portfolios.user_summary",

  // Реальная история стоимости портфеля во времени, посчитанная как
  // свёртка транзакций × ценовых историй активов. Возвращает только
  // точки начиная с даты первой транзакции (раньше — портфель пустой).
  VALUE_HISTORY: "portfolios.valueHistory",
};