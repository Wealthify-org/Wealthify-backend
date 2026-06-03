// Переиспользуем базовые типы графиков из crypto-data-worker, чтобы фронт
// мог рендерить графики акций тем же компонентом, что и крипту.
import {
  ChartPayload,
  RangeKey,
  SeriesPoint,
  Sparkline7D,
} from '../../crypto-data-worker/types/crypto-data-worker.types';

export type { ChartPayload, RangeKey, SeriesPoint, Sparkline7D };

// Набор графиков по диапазонам (h24, d7, d30, d90, d365, max).
export type StockCharts = Partial<Record<RangeKey, ChartPayload>>;

/**
 * Плоский снапшот данных по акции, который fetcher собирает из MOEX ISS и
 * передаёт в StockDataWorkerService для upsert'а. Все денежные значения — в
 * рублях (валюта торгов на MOEX), поэтому отдельного `*Usd` суффикса нет.
 *
 * `secid` — тикер MOEX (например `SBER`, `GAZP`, `SBERP`). Он глобально
 * уникален на бирже и служит идентити-ключом (аналог crypto-slug): по нему
 * мы находим/создаём строки и связываем `assets.slug`.
 */
export interface StockData {
  secid: string;
  boardId: string;
  shortName: string;
  name: string;

  isin?: string | null;
  currency: string; // 'RUB'
  lotSize?: number | null;
  issueSize?: number | null; // кол-во акций в выпуске
  faceValue?: number | null;
  listLevel?: number | null; // уровень листинга: 1 / 2 / 3

  currentPrice?: number | null;
  prevPrice?: number | null; // закрытие предыдущего торгового дня
  openPrice?: number | null;
  highPrice?: number | null;
  lowPrice?: number | null;

  dayChangePct?: number | null; // изменение за день, % (LASTTOPREVPRICE)
  change7DPct?: number | null;
  change30DPct?: number | null;
  change1YPct?: number | null;

  marketCap?: number | null; // капитализация в рублях
  valueToday?: number | null; // оборот за день, рубли
  volumeToday?: number | null; // объём за день, штук
  numTrades?: number | null;

  rank?: number | null; // ранг по капитализации (1 = крупнейшая)

  sparkline7D?: Sparkline7D;
  charts?: StockCharts;
}
