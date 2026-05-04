/**
 * Маппинг ID категорий на ключевые слова из CoinGecko-категорий.
 *
 * `categories` хранится в БД как строка через `;`, например:
 *   "Smart Contract Platform;Proof of Stake;Layer 1"
 *
 * При фильтрации мы матчим целые элементы (между `;`) — поэтому ключи
 * должны совпадать или быть точной подстрокой одного из элементов.
 *
 * Источник истины: используется и сервером (фильтр в SQL), и фронтом
 * (для рендеринга `categoryIds` обратно в активный chip и client-side
 * фильтра в favorites / portfolio holdings).
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  stablecoins: ["stablecoin"],
  blockchains: [
    "smart contract platform",
    "layer 1 (l1)",
    "layer 1",
    "proof-of-stake",
    "proof of stake",
    "proof-of-work",
    "proof of work",
  ],
  l2: ["layer 2 (l2)", "layer 2", "rollup"],
  defi: [
    "decentralized finance (defi)",
    "decentralized finance",
    "decentralized exchange",
    "lending/borrowing",
    "lending",
  ],
  liquidStaking: [
    "liquid staking tokens",
    "liquid staking",
    "liquid restaking tokens",
    "liquid restaking",
    "lst",
    "lrt",
  ],
  ai: [
    "artificial intelligence (ai)",
    "artificial intelligence",
    "ai & big data",
    "machine learning",
  ],
  aiAgents: ["ai agents", "ai meme", "ai agent launchpad"],
  meme: ["meme"],
  rwa: [
    "real world assets (rwa)",
    "real world assets",
    "tokenized assets",
    "tokenized stocks",
    "tokenized commodities",
  ],
  gaming: ["gaming (gamefi)", "gamefi", "gaming", "play-to-earn", "play to earn"],
  depin: [
    "depin",
    "decentralized physical infrastructure (depin)",
    "decentralized physical infrastructure",
  ],
  privacy: ["privacy coins", "privacy", "zero knowledge (zk)", "zero knowledge", "mixer"],
  exchangeTokens: [
    "exchange-based tokens",
    "exchange-based token",
    "centralized exchange (cex) token",
    "centralized exchange token",
    "cex tokens",
  ],
};

export type CategoryId = keyof typeof CATEGORY_KEYWORDS;

/**
 * Парсит сырую строку `categories` (через `;`) в массив тегов в нижнем
 * регистре, обрезает пробелы. Пустые элементы отбрасываются.
 */
export const parseCategoriesString = (raw: string | null | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
};

/**
 * По сырой строке `categories` возвращает массив наших ID-категорий, под
 * которые подходит этот актив. Строгая проверка по точным элементам тегов
 * (а не по подстроке во всей строке): "Meme" попадает в `meme`, но
 * "AI Memes" — в `aiAgents`, не в `meme`.
 */
export const getAssetCategoryIds = (raw: string | null | undefined): string[] => {
  const tags = parseCategoriesString(raw);
  if (!tags.length) return [];
  const matched: string[] = [];
  for (const id of Object.keys(CATEGORY_KEYWORDS)) {
    const keywords = CATEGORY_KEYWORDS[id];
    const hit = keywords.some((kw) => tags.includes(kw));
    if (hit) matched.push(id);
  }
  return matched;
};

/**
 * Возвращает все ILIKE-паттерны для фильтрации по категории.
 * Паттерны учитывают границы между `;`, так что `meme` не зацепит `AI Memes`.
 *
 * Пример возвращаемого паттерна: ['meme', 'meme;%', '%;meme;%', '%;meme'].
 */
export const buildCategoryIlikePatterns = (categoryId: string): string[] => {
  const keywords = CATEGORY_KEYWORDS[categoryId];
  if (!keywords) return [];
  const patterns: string[] = [];
  for (const kw of keywords) {
    patterns.push(kw, `${kw};%`, `%;${kw};%`, `%;${kw}`);
  }
  return patterns;
};
