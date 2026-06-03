export type SearchAssetDto = {
  id: number;
  // Дискриминатор типа актива. Поле опционально для обратной совместимости:
  // старые ответы (только крипта) его не присылали — фронт по умолчанию
  // трактует отсутствие как "crypto".
  kind?: "crypto" | "stock";
  name: string;
  ticker: string;
  logoUrlLocal: string | null;
  // ISIN нужен фронту для подгрузки логотипа акции (CDN Т-Инвестиций по ISIN).
  // Для крипты всегда null.
  isin?: string | null;
  rank: number | null;
  // ВНИМАНИЕ: для крипты — цена в USD, для акции — цена в RUB. Поле служит
  // транспортом; символ валюты фронт выбирает по `kind`.
  currentPriceUsd: number | null;
  change24HUsdPct: number | null;
  categories: string | null;
  contractAddress: string | null;
};
