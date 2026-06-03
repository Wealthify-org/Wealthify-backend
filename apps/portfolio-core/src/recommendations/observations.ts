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

  // Для портфеля акций крипто-категории (stables/BTC/ETH/alts) не имеют смысла —
  // строим только универсальные наблюдения (концентрация / диверсификация).
  const isStock = (portfolio.type ?? "").toLowerCase().startsWith("stock");

  if (!portfolio.assets.length || portfolio.totalValueUsd <= 0) {
    obs.push({
      kind: "no_assets",
      severity: 1,
      fact: "Портфель пуст — нет активов, по которым можно дать рекомендации.",
    });
    return { observations: obs, actualAllocation: actual };
  }

  // 1) Concentration — есть ли актив >50% от портфеля.
  //    severity 1 (warning) — только для очень высокой концентрации ≥80%.
  //    severity 2 (info)    — концентрация 50–80%.
  for (const a of portfolio.assets) {
    const sharePct = (a.valueUsd / portfolio.totalValueUsd) * 100;
    if (sharePct >= 50) {
      obs.push({
        kind: "high_concentration",
        severity: sharePct >= 80 ? 1 : 2,
        fact: `${a.ticker} занимает ${sharePct.toFixed(1)}% портфеля — высокая концентрация в одном активе.`,
        data: { ticker: a.ticker, sharePct: Math.round(sharePct) },
      });
    }
  }

  // 2) Low diversification — всего <= 2 активов (всегда info, не warning)
  if (portfolio.assets.length <= 2) {
    obs.push({
      kind: "low_diversification",
      severity: 3,
      fact: `Портфель содержит всего ${portfolio.assets.length} актив(а) — низкая диверсификация.`,
      data: { assetCount: portfolio.assets.length },
    });
  }

  if (risk && !isStock) {
    const target = risk.targetAllocation;

    // 3) Drift по категориям — отклонение от целевой.
    //    Все drift'ы идут как наблюдения (severity 3), не warning'и.
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
          severity: 3,
          fact: `Доля категории "${cat}" составляет ${actualPct.toFixed(1)}% при целевой ${targetPct}% (отклонение ${delta > 0 ? "+" : ""}${delta.toFixed(1)} п.п.).`,
          data: { actualPct, targetPct, deltaPp: Math.round(delta * 10) / 10 },
        });
      }
    }

    // 4) Excessive small alts для Conservative/Moderate — info, не warning
    if (
      (risk.bucket === "Conservative" || risk.bucket === "Moderate") &&
      actual.smallAlts > target.smallAlts + 10
    ) {
      obs.push({
        kind: "excessive_small_alts",
        severity: 3,
        fact: `Доля мелких альткоинов ${actual.smallAlts.toFixed(1)}% выше целевой ${target.smallAlts}% для профиля "${risk.bucketTitle}".`,
        data: { actualPct: actual.smallAlts, targetPct: target.smallAlts },
      });
    }

    // 5) Missing stables — warning только для консервативного профиля при
    //    почти полном отсутствии стейблов; иначе info.
    if (
      risk.bucket === "Conservative" &&
      actual.stables < Math.max(20, target.stables - 15)
    ) {
      const isCritical = actual.stables < 5;
      obs.push({
        kind: "missing_stables",
        severity: isCritical ? 1 : 3,
        fact: `Стейблкоинов в портфеле ${actual.stables.toFixed(1)}% при ориентире ${target.stables}% для консервативного профиля.`,
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

  // severity → level: 1 = warning (только реальные системные риски),
  //                   2 = info (наблюдение средней значимости),
  //                   3 = info (мягкое наблюдение / идея для размышления)
  const sevToLevel = (s: 1 | 2 | 3): "warning" | "info" =>
    s === 1 ? "warning" : "info";

  return observations.slice(0, 6).map((o): RecommendationDto => {
    switch (o.kind) {
      case "no_assets":
        return {
          level: "info",
          title: "Портфель пока пуст",
          description:
            "Добавьте несколько активов, чтобы платформа смогла оценить структуру и предложить персональные идеи.",
          action: "Можно начать с добавления первых позиций в портфель.",
        };
      case "high_concentration":
        return {
          level: sevToLevel(o.severity),
          title: `Высокая доля ${o.data?.ticker} в портфеле`,
          description:
            o.fact +
            " Это означает, что динамика портфеля сильно повторяет движение одного актива.",
          action: `Можно подумать о постепенном добавлении других активов, чтобы снизить зависимость от ${o.data?.ticker}.`,
        };
      case "low_diversification":
        return {
          level: "info",
          title: "Небольшое число активов в портфеле",
          description:
            o.fact +
            " Несколько разных активов в портфеле обычно делают его более устойчивым к движениям отдельных позиций.",
          action:
            "Один из вариантов — добавить активы из разных секторов/категорий для большей устойчивости.",
        };
      case "stables_drift":
      case "btc_drift":
      case "eth_drift":
      case "alts_drift":
        return {
          level: "info",
          title: "Отклонение от целевой структуры",
          description:
            o.fact +
            (risk
              ? ` Для профиля «${risk.bucketTitle}» это просто наблюдение — можно учесть при следующей перебалансировке.`
              : ""),
        };
      case "excessive_small_alts":
        return {
          level: "info",
          title: "Заметная доля мелких альткоинов",
          description:
            o.fact +
            " Мелкие альткоины — самые волатильные активы, и их доля влияет на общий уровень риска портфеля.",
          action:
            "Стоит подумать о том, чтобы перевести часть прибыли в более устойчивые активы — стейблы, BTC или ETH.",
        };
      case "missing_stables":
        return {
          level: sevToLevel(o.severity),
          title: "Мало стейблкоинов в портфеле",
          description:
            o.fact +
            " Стейблы дают запас ликвидности — на просадках их можно использовать для входа в активы по более низким ценам.",
          action:
            "Полезно было бы выделить часть капитала в стейблкоины — это создаст резерв на случай рыночных колебаний.",
        };
      case "healthy_match":
        return {
          level: "positive",
          title: "Структура близка к целевой",
          description:
            o.fact +
            " Можно отслеживать перебалансировку раз в 1–3 месяца — этого обычно достаточно.",
        };
    }
  });
}
