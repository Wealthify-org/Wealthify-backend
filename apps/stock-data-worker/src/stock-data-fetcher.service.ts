import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  ChartPayload,
  RangeKey,
  SeriesPoint,
  Sparkline7D,
  StockCharts,
  StockData,
} from '@libs/contracts/stock-data-worker';
import {
  MoexCandle,
  MoexInterval,
  MoexIssClient,
  MoexRow,
  MOEX_SHARES_BOARD,
} from './moex/moex-iss.client';
import { StockDataWorkerService } from './stock-data-worker.service';

// Конфиг диапазонов графиков → MOEX-интервалы свечей.
const CHART_RANGES: Array<{ key: RangeKey; interval: MoexInterval; days: number | 'max' }> = [
  { key: 'h24', interval: 10, days: 1 }, // 10-мин свечи за сутки
  { key: 'd7', interval: 60, days: 7 }, // часовые за неделю
  { key: 'd30', interval: 24, days: 30 }, // дневные
  { key: 'd90', interval: 24, days: 90 },
  { key: 'd365', interval: 24, days: 365 },
  { key: 'max', interval: 24, days: 'max' },
];

// Начало истории для диапазона max (дневные свечи). Раньше большинства
// российских листингов; ISS вернёт фактически доступный отрезок.
const MAX_HISTORY_START = process.env.MOEX_HISTORY_START ?? '2014-01-01';

const DAY_MS = 86_400_000;

@Injectable()
export class StockDataFetcherService implements OnModuleInit {
  private readonly log = new Logger(StockDataFetcherService.name);

  private snapshotRunning = false;
  private chartsRunning = false;

  constructor(
    private readonly client: MoexIssClient,
    private readonly stockService: StockDataWorkerService,
  ) {}

  // ───────────────────────── lifecycle ─────────────────────────

  onModuleInit(): void {
    // Бутстрап в фоне: не блокируем app.listen() (иначе RMQ-консьюмер не
    // поднимется, пока тянутся ~250 бумаг + свечи). Любая ошибка — только в лог,
    // процесс не падает.
    setTimeout(() => {
      void this.bootstrap();
    }, 0);
  }

  private async bootstrap(): Promise<void> {
    try {
      await this.refreshSnapshots();
    } catch (e) {
      this.log.error(`Initial snapshot refresh failed: ${this.errMsg(e)}`);
    }
    // Логотипы — после снапшотов (нужны secid/isin), но до тяжёлых графиков:
    // лого важнее для первого впечатления и качается быстрее.
    try {
      await this.stockService.backfillLogos();
    } catch (e) {
      this.log.error(`Initial logo backfill failed: ${this.errMsg(e)}`);
    }
    try {
      await this.refreshCharts();
    } catch (e) {
      this.log.error(`Initial charts refresh failed: ${this.errMsg(e)}`);
    }
  }

  // Логотипы меняются редко — добиваем недостающие раз в неделю.
  @Cron('0 3 * * 1')
  async logosCron(): Promise<void> {
    try {
      await this.stockService.backfillLogos();
    } catch (e) {
      this.log.error(`logosCron failed: ${this.errMsg(e)}`);
    }
  }

  // ───────────────────────── cron ─────────────────────────

  // Котировки на MOEX идут с задержкой ~15 мин — чаще обновлять смысла нет.
  @Cron('*/15 * * * *')
  async snapshotCron(): Promise<void> {
    if (this.snapshotRunning) {
      this.log.warn('snapshotCron: previous run still in progress, skipping');
      return;
    }
    try {
      await this.refreshSnapshots();
    } catch (e) {
      this.log.error(`snapshotCron failed: ${this.errMsg(e)}`);
    }
  }

  // Свечи/история — тяжёлый проход, гоняем раз в сутки ночью.
  @Cron('0 2 * * *')
  async chartsCron(): Promise<void> {
    if (this.chartsRunning) {
      this.log.warn('chartsCron: previous run still in progress, skipping');
      return;
    }
    try {
      await this.refreshCharts();
    } catch (e) {
      this.log.error(`chartsCron failed: ${this.errMsg(e)}`);
    }
  }

  // ───────────────────────── snapshot pass ─────────────────────────

  async refreshSnapshots(): Promise<void> {
    if (this.snapshotRunning) return;
    this.snapshotRunning = true;
    const startedAt = Date.now();
    try {
      this.log.log(`Fetching ${MOEX_SHARES_BOARD} board securities from MOEX ISS...`);
      const rawRows = await this.client.fetchBoardSecurities();

      const stocks = rawRows
        .map((row) => this.mapRowToStockData(row))
        .filter((s): s is StockData => s !== null);

      this.assignRanks(stocks);

      this.log.log(`Got ${stocks.length} stocks, upserting snapshots...`);

      let ok = 0;
      let failed = 0;
      for (const stock of stocks) {
        try {
          await this.stockService.upsertSnapshot(stock);
          ok += 1;
        } catch (e) {
          failed += 1;
          this.log.warn(`Upsert snapshot failed for ${stock.secid}: ${this.errMsg(e)}`);
        }
      }

      this.log.log(
        `Snapshots done: ${ok} ok, ${failed} failed, ${Math.round((Date.now() - startedAt) / 1000)}s`,
      );
    } finally {
      this.snapshotRunning = false;
    }
  }

  // ───────────────────────── charts pass ─────────────────────────

  async refreshCharts(): Promise<void> {
    if (this.chartsRunning) return;
    this.chartsRunning = true;
    const startedAt = Date.now();
    try {
      const secids = await this.stockService.listTrackedSecids();
      if (secids.length === 0) {
        this.log.warn('refreshCharts: no tracked stocks yet, skipping');
        return;
      }

      this.log.log(`Refreshing charts for ${secids.length} stocks...`);

      let ok = 0;
      let failed = 0;
      for (const secid of secids) {
        try {
          const charts = await this.fetchChartsForStock(secid);
          const derived = this.computeDerived(charts);
          await this.stockService.saveDerivedAndCharts(secid, { charts, ...derived });
          ok += 1;
        } catch (e) {
          failed += 1;
          this.log.warn(`Charts refresh failed for ${secid}: ${this.errMsg(e)}`);
        }
        await this.sleep(60); // лёгкая пауза между бумагами
      }

      this.log.log(
        `Charts done: ${ok} ok, ${failed} failed, ${Math.round((Date.now() - startedAt) / 1000)}s`,
      );
    } finally {
      this.chartsRunning = false;
    }
  }

  private async fetchChartsForStock(secid: string): Promise<StockCharts> {
    const charts: StockCharts = {};
    const till = this.toIsoDate(new Date());

    for (const range of CHART_RANGES) {
      try {
        const from =
          range.days === 'max'
            ? MAX_HISTORY_START
            : this.toIsoDate(new Date(Date.now() - range.days * DAY_MS));

        const candles = await this.client.fetchCandles(secid, {
          interval: range.interval,
          from,
          till,
        });

        charts[range.key] = this.candlesToPayload(candles);
      } catch (e) {
        // Один сбойный диапазон не должен валить остальные.
        this.log.debug(`[${secid}:${range.key}] candles failed: ${this.errMsg(e)}`);
      }
      await this.sleep(80);
    }

    return charts;
  }

  private candlesToPayload(candles: MoexCandle[]): ChartPayload {
    const stats: SeriesPoint[] = [];
    const volumes: SeriesPoint[] = [];

    for (const c of candles) {
      const ts = this.parseMoexDatetime(c.begin);
      if (ts === null) continue;
      if (typeof c.close === 'number') stats.push([ts, c.close]);
      // объём — оборот в рублях (value); если его нет, берём объём в штуках
      const vol = c.value ?? c.volume;
      if (typeof vol === 'number') volumes.push([ts, vol]);
    }

    return { stats, total_volumes: volumes };
  }

  // Считаем sparkline + изменения за 7д/30д/1г по дневным/часовым свечам.
  private computeDerived(charts: StockCharts): {
    sparkline7D: Sparkline7D | null;
    change7DPct: number | null;
    change30DPct: number | null;
    change1YPct: number | null;
  } {
    const now = Date.now();
    const d7 = charts.d7?.stats ?? [];
    const daily = charts.d365?.stats?.length ? charts.d365.stats : charts.max?.stats ?? [];

    const sparkPrices = d7.map((p) => p[1]).filter((v) => Number.isFinite(v));
    const sparkline7D: Sparkline7D | null =
      sparkPrices.length > 0 ? { prices: sparkPrices } : null;

    return {
      sparkline7D,
      change7DPct: this.pctChangeOverDays(daily, 7, now),
      change30DPct: this.pctChangeOverDays(daily, 30, now),
      change1YPct: this.pctChangeOverDays(daily, 365, now),
    };
  }

  // Изменение цены за N календарных дней, относительно «сейчас».
  //
  // Защиты от мусора у неликвида/делистнутых бумаг (был кейс GAZT +1864%):
  //  1. Если последняя свеча устарела > STALE_MAX дней — бумага фактически не
  //     торгуется, любой «N-дневный» change посчитался бы в прошлом → null.
  //  2. База ищется относительно (now − N дней), НЕ относительно последней
  //     свечи. И база должна лежать РЯДОМ с этой датой: если ближайшая свеча
  //     сильно старше cutoff (разрежённая история) — это не «N-дневное»
  //     изменение, а скачок через годы → null.
  private pctChangeOverDays(
    series: SeriesPoint[],
    days: number,
    now: number,
  ): number | null {
    if (!series.length) return null;
    const sorted = [...series].sort((a, b) => a[0] - b[0]);

    const last = sorted[sorted.length - 1];
    const lastPrice = last[1];
    if (!Number.isFinite(lastPrice) || lastPrice === 0) return null;

    // (1) бумага не торговалась в последние ~10 дней — не считаем изменения
    const STALE_MAX = 10 * DAY_MS;
    if (now - last[0] > STALE_MAX) return null;

    const cutoff = now - days * DAY_MS;

    // последняя свеча с ts <= cutoff
    let base: SeriesPoint | null = null;
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (sorted[i][0] <= cutoff) {
        base = sorted[i];
        break;
      }
    }
    if (!base) return null; // истории меньше N дней — не выдумываем

    // (2) база должна быть рядом с cutoff (для коротких окон — пара недель,
    // для года — несколько месяцев). Иначе это не честный N-дневный change.
    const tolerance = Math.max(14 * DAY_MS, days * 0.25 * DAY_MS);
    if (cutoff - base[0] > tolerance) return null;

    const basePrice = base[1];
    if (!Number.isFinite(basePrice) || basePrice === 0) return null;

    return ((lastPrice - basePrice) / basePrice) * 100;
  }

  // ───────────────────────── mapping ─────────────────────────

  private mapRowToStockData(row: MoexRow): StockData | null {
    const secid = this.str(row.SECID);
    if (!secid) return null;

    const currentPrice =
      this.num(row.LAST) ?? this.num(row.MARKETPRICE) ?? this.num(row.PREVPRICE);
    const prevPrice = this.num(row.PREVPRICE);
    const issueSize = this.num(row.ISSUESIZE);

    const issueCap = this.num(row.ISSUECAPITALIZATION);
    const marketCap =
      issueCap ?? (issueSize !== null && currentPrice !== null ? issueSize * currentPrice : null);

    return {
      secid,
      boardId: this.str(row.BOARDID) ?? MOEX_SHARES_BOARD,
      shortName: this.str(row.SHORTNAME) ?? secid,
      name: this.str(row.SECNAME) ?? this.str(row.SHORTNAME) ?? secid,

      isin: this.str(row.ISIN),
      currency: this.mapCurrency(this.str(row.CURRENCYID)),
      lotSize: this.num(row.LOTSIZE),
      issueSize,
      faceValue: this.num(row.FACEVALUE),
      listLevel: this.num(row.LISTLEVEL),

      currentPrice,
      prevPrice,
      openPrice: this.num(row.OPEN),
      highPrice: this.num(row.HIGH),
      lowPrice: this.num(row.LOW),

      dayChangePct: this.num(row.LASTTOPREVPRICE),

      marketCap,
      valueToday: this.num(row.VALTODAY),
      volumeToday: this.num(row.VOLTODAY),
      numTrades: this.num(row.NUMTRADES),
    };
  }

  // Ранжируем по капитализации (desc). Бумаги без капы → rank=null (в конец).
  private assignRanks(stocks: StockData[]): void {
    const withCap = stocks
      .filter((s) => typeof s.marketCap === 'number' && s.marketCap! > 0)
      .sort((a, b) => (b.marketCap! - a.marketCap!));

    const rankBySecid = new Map<string, number>();
    withCap.forEach((s, i) => rankBySecid.set(s.secid, i + 1));

    for (const s of stocks) {
      s.rank = rankBySecid.get(s.secid) ?? null;
    }
  }

  // ───────────────────────── утилиты ─────────────────────────

  private mapCurrency(code: string | null): string {
    if (!code) return 'RUB';
    // MOEX отдаёт 'SUR' для российского рубля.
    if (code === 'SUR' || code === 'RUB' || code === 'RUR') return 'RUB';
    return code;
  }

  // MOEX-время в формате 'YYYY-MM-DD HH:mm:ss' по Москве (UTC+3) → UTC ms.
  private parseMoexDatetime(s: string | null): number | null {
    if (!s) return null;
    const iso = `${s.replace(' ', 'T')}+03:00`;
    const ts = Date.parse(iso);
    return Number.isFinite(ts) ? ts : null;
  }

  private toIsoDate(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private num(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private str(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed.length ? trimmed : null;
  }

  private errMsg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
