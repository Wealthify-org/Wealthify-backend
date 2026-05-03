/**
 * Rule-based "наблюдения" над портфелем.
 * Подаются в LLM как структурированный контекст, а если LLM упал — конвертируются
 * напрямую в рекомендации (fallback).
 */

import { RecommendationDto } from "@libs/contracts";

export interface AssetSnapshot {
  ticker: string;
  name: string;
  type: string;
  quantity: number;
  averageBuyPrice: number;
  currentPriceUsd: number;
  valueUsd: number;
  investedUsd: number;
  profitUsd: number;
  profitPct: number;
  change24HUsdPct: number;
}

export interface PortfolioSnapshot {
  id: number;
  name: string;
  type: string;
  totalValueUsd: number;
  totalInvestedUsd: number;
  totalProfitPct: number;
  change24hPct: number;
  assets: AssetSnapshot[];
}

export interface RiskProfileSnapshot {
  bucket: "Conservative" | "Moderate" | "Aggressive" | "Speculative";
  bucketTitle: string;
  acceptableDrawdownPct: number;
  /** Целевая аллокация в %, сумма = 100. */
  targetAllocation: {
    stables: number;
    btc: number;
    eth: number;
    largeAlts: number;
    smallAlts: number;
  };
}

export interface PortfolioActualAllocation {
  stables: number;
  btc: number;
  eth: number;
  largeAlts: number;
  smallAlts: number;
}

export type ObservationKind =
  | "no_assets"
  | "high_concentration"
  | "low_diversification"
  | "stables_drift"
  | "btc_drift"
  | "eth_drift"
  | "alts_drift"
  | "excessive_small_alts"
  | "missing_stables"
  | "healthy_match";

export interface Observation {
  kind: ObservationKind;
  /** Серьёзность для сортировки/отбора в UI. 1 — критично, 3 — наблюдение. */
  severity: 1 | 2 | 3;
  /** Короткое описание факта в plain text (для LLM-prompt'а). */
  fact: string;
  /** Дополнительные структурированные данные для LLM/fallback. */
  data?: Record<string, unknown>;
}

// ── классификация активов в категории целевой аллокации ─────────────────

const STABLECOIN_TICKERS = new Set([
  "USDT", "USDC", "DAI", "TUSD", "BUSD", "USDE", "FDUSD",
  "PYUSD", "USDD", "FRAX", "USDS", "USD1", "USDY", "USD",
]);

const LARGE_ALT_TICKERS = new Set([
  "BNB", "SOL", "XRP", "ADA", "AVAX", "DOT", "LINK", "TRX",
  "MATIC", "POL", "TON", "LTC", "BCH", "DOGE", "SUI", "NEAR",
  "ATOM", "ARB", "OP", "FIL", "APT", "ICP", "INJ", "RUNE",
  "HBAR", "VET", "STX", "ALGO", "AAVE",
]);

function classify(asset: AssetSnapshot):
  | "stables"
  | "btc"
  | "eth"
  | "largeAlts"
  | "smallAlts" {
  const tk = asset.ticker.toUpperCase();
  if (STABLECOIN_TICKERS.has(tk)) return "stables";
  if (tk === "BTC" || tk === "WBTC" || tk === "TBTC") return "btc";
  if (tk === "ETH" || tk === "WETH" || tk === "STETH" || tk === "WSTETH" || tk === "WBETH") {
    return "eth";
  }
  if (LARGE_ALT_TICKERS.has(tk)) return "largeAlts";
  return "smallAlts";
}

export function calcActualAllocation(
  portfolio: PortfolioSnapshot,
): PortfolioActualAllocation {
  const total = portfolio.totalValueUsd;
  const result: PortfolioActualAllocation = {
    stables: 0, btc: 0, eth: 0, largeAlts: 0, smallAlts: 0,
  };
  if (total <= 0) return result;
  for (const a of portfolio.assets) {
    const cat = classify(a);
    result[cat] += (a.valueUsd / total) * 100;
  }
  // округляем до 1 знака
  (Object.keys(result) as Array<keyof typeof result>).forEach(
    (k) => (result[k] = Math.round(result[k] * 10) / 10),
  );
  return result;
}

// ── собственно построение наблюдений ────────────────────────────────────

export function buildObservations(
  portfolio: PortfolioSnapshot,
  risk: RiskProfileSnapshot | null,
): { observations: Observation[]; actualAllocation: PortfolioActualAllocation } {
  const obs: Observation[] = [];
  const actual = calcActualAllocation(portfolio);

  if (!portfolio.assets.length || portfolio.totalValueUsd <= 0) {
    obs.push({
      kind: "no_assets",
      severity: 1,
      fact: "Портфель пуст — нет активов, по которым можно дать рекомендации.",
    });
    return { observations: obs, actualAllocation: actual };
  }

  // 1) Concentration — есть ли актив >50% от портфеля
  for (const a of portfolio.assets) {
    const sharePct = (a.valueUsd / portfolio.totalValueUsd) * 100;
    if (sharePct >= 50) {
      obs.push({
        kind: "high_concentration",
        severity: 1,
        fact: `${a.ticker} занимает ${sharePct.toFixed(1)}% портфеля — высокая концентрация в одном активе.`,
        data: { ticker: a.ticker, sharePct: Math.round(sharePct) },
      });
    }
  }

  // 2) Low diversification — всего <= 2 активов
  if (portfolio.assets.length <= 2) {
    obs.push({
      kind: "low_diversification",
      severity: 2,
      fact: `Портфель содержит всего ${portfolio.assets.length} актив(а) — низкая диверсификация.`,
      data: { assetCount: portfolio.assets.length },
    });
  }

  if (risk) {
    const target = risk.targetAllocation;

    // 3) Drift по категориям — отклонение от целевой
    const driftKinds: Array<{
      cat: keyof PortfolioActualAllocation;
      kind: ObservationKind;
    }> = [
      { cat: "stables", kind: "stables_drift" },
      { cat: "btc", kind: "btc_drift" },
      { cat: "eth", kind: "eth_drift" },
      { cat: "largeAlts", kind: "alts_drift" },
    ];

    for (const { cat, kind } of driftKinds) {
      const actualPct = actual[cat];
      const targetPct = target[cat];
      const delta = actualPct - targetPct;
      if (Math.abs(delta) >= 12) {
        obs.push({
          kind,
          severity: Math.abs(delta) >= 25 ? 1 : 2,
          fact: `Доля категории "${cat}" составляет ${actualPct.toFixed(1)}% при целевой ${targetPct}% (отклонение ${delta > 0 ? "+" : ""}${delta.toFixed(1)} п.п.).`,
          data: { actualPct, targetPct, deltaPp: Math.round(delta * 10) / 10 },
        });
      }
    }

    // 4) Excessive small alts для Conservative/Moderate
    if (
      (risk.bucket === "Conservative" || risk.bucket === "Moderate") &&
      actual.smallAlts > target.smallAlts + 10
    ) {
      obs.push({
        kind: "excessive_small_alts",
        severity: 1,
        fact: `Доля мелких альткоинов ${actual.smallAlts.toFixed(1)}% превышает рекомендуемую для профиля "${risk.bucketTitle}" (целевая ≤${target.smallAlts}%).`,
        data: { actualPct: actual.smallAlts, targetPct: target.smallAlts },
      });
    }

    // 5) Missing stables для Conservative
    if (
      risk.bucket === "Conservative" &&
      actual.stables < Math.max(20, target.stables - 15)
    ) {
      obs.push({
        kind: "missing_stables",
        severity: 1,
        fact: `Стейблкоинов в портфеле всего ${actual.stables.toFixed(1)}% при рекомендуемых ${target.stables}% для консервативного профиля.`,
        data: { actualPct: actual.stables, targetPct: target.stables },
      });
    }

    // 6) Healthy match — все основные категории в пределах ±10 п.п.
    const allCloseToTarget = (
      ["stables", "btc", "eth", "largeAlts"] as const
    ).every((c) => Math.abs(actual[c] - target[c]) <= 10);
    if (allCloseToTarget && portfolio.assets.length >= 3 && obs.length === 0) {
      obs.push({
        kind: "healthy_match",
        severity: 3,
        fact: `Структура портфеля близка к целевой для профиля "${risk.bucketTitle}" — все ключевые категории в пределах ±10 п.п.`,
      });
    }
  }

  return { observations: obs, actualAllocation: actual };
}

/**
 * Fallback: превращает наблюдения в финальные рекомендации без LLM.
 * Используется если OpenRouter недоступен.
 */
export function observationsToRecommendations(
  observations: Observation[],
  risk: RiskProfileSnapshot | null,
): RecommendationDto[] {
  if (observations.length === 0) {
    return [
      {
        level: "info",
        title: "Достаточно данных пока нет",
        description:
          "Портфель не содержит выраженных рисков, но активов слишком мало для глубокого анализа. Расширьте диверсификацию для более точных рекомендаций.",
      },
    ];
  }

  return observations.slice(0, 6).map((o): RecommendationDto => {
    switch (o.kind) {
      case "no_assets":
        return {
          level: "info",
          title: "Портфель пока пуст",
          description:
            "Добавьте несколько активов, чтобы платформа смогла оценить структуру и выдать персональные рекомендации.",
          action: "Добавить активы в портфель",
        };
      case "high_concentration":
        return {
          level: "warning",
          title: `Концентрация в ${o.data?.ticker}`,
          description: o.fact + " При резком движении этого актива потери будут болезненными.",
          action: `Сократите долю ${o.data?.ticker} до 30–40% и распределите по нескольким активам.`,
        };
      case "low_diversification":
        return {
          level: "warning",
          title: "Низкая диверсификация",
          description: o.fact +
            " Для устойчивости портфеля рекомендуется держать минимум 4–6 различных активов.",
          action: "Добавьте 3–5 активов из разных категорий (BTC, ETH, крупные альты, стейблы).",
        };
      case "stables_drift":
      case "btc_drift":
      case "eth_drift":
      case "alts_drift":
        return {
          level: o.severity === 1 ? "warning" : "info",
          title: "Отклонение от целевой структуры",
          description: o.fact +
            (risk
              ? ` Для профиля "${risk.bucketTitle}" структура должна быть ближе к рекомендуемой.`
              : ""),
        };
      case "excessive_small_alts":
        return {
          level: "warning",
          title: "Слишком много мелких альткоинов",
          description: o.fact +
            " Мелкие альткоины — самые волатильные активы и могут резко обесцениться.",
          action: "Зафиксируйте часть прибыли в стейблах или крупных активах (BTC/ETH).",
        };
      case "missing_stables":
        return {
          level: "warning",
          title: "Не хватает стейблкоинов",
          description: o.fact +
            " Стейблы — это «подушка безопасности» и инструмент для входа в просадках.",
          action: "Зафиксируйте 20–30% портфеля в стейблкоинах.",
        };
      case "healthy_match":
        return {
          level: "positive",
          title: "Структура соответствует профилю",
          description: o.fact +
            " Продолжайте отслеживать перебалансировку — раз в 1–3 месяца достаточно.",
        };
    }
  });
}
