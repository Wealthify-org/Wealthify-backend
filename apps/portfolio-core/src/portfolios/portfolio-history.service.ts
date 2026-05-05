import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { InjectModel } from "@nestjs/sequelize";
import { catchError, lastValueFrom, of, timeout } from "rxjs";

import { rpcError } from "@libs/contracts/common";
import { CRYPTO_DATA_WORKER_PATTERNS } from "@libs/contracts/crypto-data-worker/crypto-data-worker.pattern";
import { ASSETS_PATTERNS } from "@libs/contracts/assets/assets.pattern";
import { TransactionType } from "@libs/contracts/common/enums/transaction-type.enum";
import {
  ValueHistoryPeriod,
  ValueHistoryPoint,
  ValueHistoryResponse,
  VALUE_HISTORY_PERIODS,
} from "@libs/contracts/portfolios/dto/value-history.dto";

import { Portfolio } from "./portfolios.model";
import { Transaction } from "../transactions/transactions.model";
import { PortfolioAssets } from "../portfolio-assets/portfolio-assets.model";
import { ASSETS_CLIENT, WORKER_CLIENT } from "./portfolio.constants";

const RPC_TIMEOUT_MS = 8_000;

/**
 * Какой ключ серии чарта взять с crypto-data-worker для запрошенного периода.
 * Чарты у воркера: h24Stats, d7Stats, d30Stats, d90Stats, d365Stats, maxStats.
 */
const PERIOD_TO_CHART_KEY: Record<ValueHistoryPeriod, string> = {
  "24h": "h24Stats",
  "7d": "d7Stats",
  "30d": "d30Stats",
  "90d": "d90Stats",
  "1y": "d365Stats",
  max: "maxStats",
};

/** Период → длительность в мс. `max` = от первой транзакции до now. */
const PERIOD_TO_MS: Record<Exclude<ValueHistoryPeriod, "max">, number> = {
  "24h": 24 * 3600_000,
  "7d": 7 * 24 * 3600_000,
  "30d": 30 * 24 * 3600_000,
  "90d": 90 * 24 * 3600_000,
  "1y": 365 * 24 * 3600_000,
};

/**
 * Структура для walking-by-time: транзакции одного актива, отсортированные
 * ASC по дате, и накопленный counter (cumulative quantity).
 */
interface AssetTxState {
  assetId: number;
  /** Все транзакции этого актива, sorted by date ASC. */
  txs: Array<{ ts: number; signedQty: number; pricePerUnit: number }>;
  /** Указатель текущей транзакции в цикле слияния (для O(N+M)). */
  cursor: number;
  /** Текущая накопленная позиция (после применения всех `txs[0..cursor-1]`). */
  cumulativeQty: number;
  /** История цен: [ts, price][] sorted by ts ASC. */
  priceSeries: Array<[number, number]>;
}

@Injectable()
export class PortfolioHistoryService {
  private readonly log = new Logger(PortfolioHistoryService.name);

  constructor(
    @InjectModel(Portfolio)
    private readonly portfolioRepo: typeof Portfolio,
    @InjectModel(Transaction)
    private readonly txRepo: typeof Transaction,
    @InjectModel(PortfolioAssets)
    private readonly portfolioAssetsRepo: typeof PortfolioAssets,
    @Inject(WORKER_CLIENT)
    private readonly workerClient: ClientProxy,
    @Inject(ASSETS_CLIENT)
    private readonly assetsClient: ClientProxy,
  ) {}

  /**
   * Возвращает историю стоимости портфеля во времени.
   *
   * Алгоритм:
   *  1. Загружаем портфель + ВСЕ его транзакции (в asc-порядке по date).
   *  2. Если транзакций нет → пустая серия.
   *  3. Определяем period boundaries: `[periodStart, now]`. Для max
   *     periodStart = дата первой транзакции; для остальных — now - период.
   *     Серия не может начинаться раньше первой транзакции.
   *  4. Группируем транзакции по assetId.
   *  5. Для каждого asset параллельно тянем чарт нужного периода с
   *     crypto-data-worker (RPC). Чарт не пришёл → asset исключается из
   *     расчёта (его вклад = 0).
   *  6. Объединяем все ts из чартов всех активов в общую сетку (sorted asc).
   *     Также добавляем ts ИЗ ТРАНЗАКЦИЙ если они в окне — чтобы виден был
   *     скачок при покупке/продаже (без этого ступенька могла "съехать"
   *     между двумя точками chart-grid).
   *  7. Для каждой точки ts:
   *     a) Для каждого asset: продвигаем cursor по транзакциям пока
   *        tx.ts <= ts, накапливая `cumulativeQty`.
   *     b) Цена asset на ts = ближайшая (last-known) цена из priceSeries
   *        с `priceTs <= ts`. Если её нет — 0 (asset не существовал).
   *     c) value(ts) += cumulativeQty * price(ts)
   *  8. invested(ts) — параллельно: сумма BUY*qty*pricePerUnit минус
   *     SELL*qty*pricePerUnit для всех tx с `tx.ts <= ts`.
   *  9. Округляем value до центов, отбрасываем точки до первой транзакции,
   *     сортируем asc и возвращаем.
   */
  async getValueHistory(
    portfolioId: number,
    period: ValueHistoryPeriod,
  ): Promise<ValueHistoryResponse> {
    if (!VALUE_HISTORY_PERIODS.includes(period)) {
      rpcError(
        HttpStatus.BAD_REQUEST,
        "INVALID_PERIOD",
        `Period must be one of ${VALUE_HISTORY_PERIODS.join(", ")}`,
      );
    }

    const portfolio = await this.portfolioRepo.findByPk(portfolioId);
    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio ${portfolioId} not found`,
      );
    }

    const allTx = await this.txRepo.findAll({
      where: { portfolioId },
      order: [["date", "ASC"]],
    });

    if (allTx.length === 0) {
      return {
        series: [],
        period,
        firstTransactionTs: null,
      };
    }

    const firstTxTs = new Date(allTx[0].dataValues.date).getTime();
    const now = Date.now();

    // 3. Определяем окно
    const windowStart =
      period === "max" ? firstTxTs : Math.max(firstTxTs, now - PERIOD_TO_MS[period]);
    const windowEnd = now;

    if (windowStart > windowEnd) {
      // sanity-check; не должно произойти, но защищаемся
      return { series: [], period, firstTransactionTs: firstTxTs };
    }

    // 4. Группируем транзакции по asset
    const txByAsset = new Map<number, Transaction[]>();
    for (const t of allTx) {
      const list = txByAsset.get(t.dataValues.assetId);
      if (list) list.push(t);
      else txByAsset.set(t.dataValues.assetId, [t]);
    }
    const assetIds = Array.from(txByAsset.keys());

    // 5. Подтягиваем тикер + тип через assets-сервис.
    //    Тип нужен чтобы для FIAT (USD) НЕ делать RPC к crypto-data-worker
    //    (у фиата нет чарта), а синтезировать плоскую серию price=1.
    //    Без этого после `convertToUsd: true` USD-позиция выпадала из
    //    расчёта → график падал на сумму проданного актива.
    const assetMetaById = new Map<number, { ticker: string; type: string }>();
    try {
      const assetRows = await lastValueFrom<
        Array<{ id: number; ticker?: string; type?: string }>
      >(
        this.assetsClient
          .send(ASSETS_PATTERNS.GET_MANY_BY_IDS, { ids: assetIds })
          .pipe(
            timeout(RPC_TIMEOUT_MS),
            catchError(
              () => of([] as Array<{ id: number; ticker?: string; type?: string }>),
            ),
          ),
      );
      for (const row of assetRows ?? []) {
        if (row?.id && row?.ticker) {
          assetMetaById.set(row.id, {
            ticker: row.ticker,
            type: String(row.type ?? ""),
          });
        }
      }
    } catch (e) {
      this.log.warn(
        `[history] could not fetch tickers via assets RPC: ${e instanceof Error ? e.message : e}`,
      );
    }

    const chartKey = PERIOD_TO_CHART_KEY[period];
    const chartPromises = assetIds.map(async (assetId) => {
      const meta = assetMetaById.get(assetId);
      if (!meta) {
        this.log.warn(
          `[history] portfolio=${portfolioId} assetId=${assetId} no ticker, skipping`,
        );
        return { assetId, priceSeries: [] as Array<[number, number]> };
      }
      const { ticker, type } = meta;

      // FIAT-USD: синтезируем плоскую серию (price=1 на всё окно).
      // Достаточно двух точек: на начало окна и на now — между ними
      // last-known-price логика всегда вернёт 1.
      if (type === "Fiat" && ticker === "USD") {
        return {
          assetId,
          priceSeries: [
            [windowStart, 1],
            [windowEnd, 1],
          ] as Array<[number, number]>,
        };
      }

      try {
        const charts = await lastValueFrom<Record<string, unknown>>(
          this.workerClient
            .send(CRYPTO_DATA_WORKER_PATTERNS.GET_CHARTS_BY_TICKER, { ticker })
            .pipe(
              timeout(RPC_TIMEOUT_MS),
              catchError(() => of({} as Record<string, unknown>)),
            ),
        );
        const raw = charts?.[chartKey];
        if (!Array.isArray(raw)) {
          return { assetId, priceSeries: [] as Array<[number, number]> };
        }
        // фильтруем мусорные точки + сортируем asc + клипуем по окну
        const series = raw
          .filter(
            (p): p is [number, number] =>
              Array.isArray(p) &&
              p.length === 2 &&
              Number.isFinite(p[0]) &&
              Number.isFinite(p[1]),
          )
          .map(([ts, price]) => [Number(ts), Number(price)] as [number, number])
          .filter(([ts]) => ts >= windowStart - 24 * 3600_000 && ts <= windowEnd)
          .sort((a, b) => a[0] - b[0]);
        return { assetId, priceSeries: series };
      } catch (e) {
        this.log.warn(
          `[history] charts fetch failed for ${ticker}: ${e instanceof Error ? e.message : e}`,
        );
        return { assetId, priceSeries: [] as Array<[number, number]> };
      }
    });
    const chartsByAsset = await Promise.all(chartPromises);

    // 6. Строим состояние по каждому активу
    const states: AssetTxState[] = chartsByAsset.map(({ assetId, priceSeries }) => {
      const txs = (txByAsset.get(assetId) ?? []).map((t) => ({
        ts: new Date(t.dataValues.date).getTime(),
        signedQty:
          t.dataValues.type === TransactionType.BUY
            ? Number(t.dataValues.quantity)
            : -Number(t.dataValues.quantity),
        pricePerUnit: Number(t.dataValues.pricePerUnit),
      }));
      // Защита: если в БД оказалась невалидная транзакция (NaN qty) —
      // отфильтруем, чтобы не отравить cumulative.
      const cleanTxs = txs.filter(
        (t) =>
          Number.isFinite(t.ts) &&
          Number.isFinite(t.signedQty) &&
          Number.isFinite(t.pricePerUnit),
      );
      cleanTxs.sort((a, b) => a.ts - b.ts);
      return {
        assetId,
        txs: cleanTxs,
        cursor: 0,
        cumulativeQty: 0,
        priceSeries,
      };
    });

    // 7. Объединяем все ts'ы из чартов + ts'ы из транзакций в окне.
    //    Используем Set для дедупа, потом sort.
    const tsSet = new Set<number>();
    for (const st of states) {
      for (const [ts] of st.priceSeries) tsSet.add(ts);
      for (const t of st.txs) {
        if (t.ts >= windowStart && t.ts <= windowEnd) tsSet.add(t.ts);
      }
    }
    // Также добавим текущий момент — чтобы график доходил до now.
    tsSet.add(windowEnd);
    // Если ни одной точки нет — пусто
    if (tsSet.size === 0) {
      return { series: [], period, firstTransactionTs: firstTxTs };
    }
    const tsList = Array.from(tsSet).sort((a, b) => a - b);

    // 8. Для каждой точки ts считаем portfolio value + invested.
    //    `lastPriceCursor[assetId]` — где мы сейчас в priceSeries
    //    (для O(N+M) вместо binary search на каждом шаге).
    const priceCursor: Map<number, number> = new Map();
    for (const st of states) priceCursor.set(st.assetId, 0);

    // Глобальный invested — обходим все tx (не группируя), но с одним
    // курсором проще: храним список всех tx в asc-порядке.
    const allCleanTx = states
      .flatMap((s) =>
        s.txs.map((t) => ({
          ts: t.ts,
          signedQty: t.signedQty,
          pricePerUnit: t.pricePerUnit,
        })),
      )
      .sort((a, b) => a.ts - b.ts);
    let investedCursor = 0;
    let cumulativeInvested = 0;

    const series: ValueHistoryPoint[] = [];

    for (const ts of tsList) {
      // a) продвигаем cursor транзакций по каждому активу
      let portfolioValue = 0;
      for (const st of states) {
        while (st.cursor < st.txs.length && st.txs[st.cursor].ts <= ts) {
          st.cumulativeQty += st.txs[st.cursor].signedQty;
          st.cursor++;
        }
        // Защита от негативной позиции (теоретически не должно — продают
        // только то что есть; но если из-за грязной БД случилось —
        // фиксируем не ниже 0).
        const qty = Math.max(0, st.cumulativeQty);
        if (qty <= 0) continue;

        // b) последняя цена с priceTs <= ts
        let pc = priceCursor.get(st.assetId) ?? 0;
        while (
          pc < st.priceSeries.length - 1 &&
          st.priceSeries[pc + 1][0] <= ts
        ) {
          pc++;
        }
        priceCursor.set(st.assetId, pc);
        const point = st.priceSeries[pc];
        // Если самая первая точка чарта позже ts → у нас нет цены на момент ts.
        // В этом случае пропускаем asset (как будто его не было).
        if (!point || point[0] > ts) continue;
        const price = point[1];
        if (!Number.isFinite(price) || price <= 0) continue;
        portfolioValue += qty * price;
      }

      // 8b) invested
      while (
        investedCursor < allCleanTx.length &&
        allCleanTx[investedCursor].ts <= ts
      ) {
        const t = allCleanTx[investedCursor];
        cumulativeInvested += t.signedQty * t.pricePerUnit;
        // signedQty > 0 при BUY → invested↑;  < 0 при SELL → invested↓ (мы изъяли)
        investedCursor++;
      }

      // Округляем до центов чтобы избежать "0.00000001" артефактов
      const value = Math.max(0, Math.round(portfolioValue * 100) / 100);
      const invested = Math.max(0, Math.round(cumulativeInvested * 100) / 100);

      // 9. Точки до первой транзакции — портфель пуст; не добавляем.
      if (ts < firstTxTs) continue;
      series.push({ ts, value, invested });
    }

    return {
      series,
      period,
      firstTransactionTs: firstTxTs,
    };
  }
}
