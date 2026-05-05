/**
 * Период истории портфеля. Совпадает с периодами для графика отдельного
 * актива (RangeKey из crypto-data-worker), плюс "max" — от даты первой
 * транзакции до now.
 */
export type ValueHistoryPeriod = "24h" | "7d" | "30d" | "90d" | "1y" | "max";

export const VALUE_HISTORY_PERIODS: ValueHistoryPeriod[] = [
  "24h",
  "7d",
  "30d",
  "90d",
  "1y",
  "max",
];

/**
 * Один отсчёт серии: timestamp (ms since epoch), стоимость портфеля
 * на этот момент в USD, и сколько было суммарно вложено к этому моменту
 * (для возможного отображения второй линии «invested»).
 */
export interface ValueHistoryPoint {
  /** Unix timestamp в миллисекундах. */
  ts: number;
  /** Стоимость портфеля в USD на момент `ts`. */
  value: number;
  /** Суммарно вложено к моменту `ts` в USD (BUY суммируется, SELL вычитается по pricePerUnit). */
  invested: number;
}

export interface ValueHistoryResponse {
  /**
   * Серия точек, отсортированная по `ts` ASC. Может быть пустой —
   * например, у портфеля без транзакций или если для всех активов нет
   * ценовой истории за период.
   */
  series: ValueHistoryPoint[];
  /** Запрошенный период (может отличаться от эффективного начала). */
  period: ValueHistoryPeriod;
  /** Дата первой транзакции в портфеле (ts) или null, если их нет. */
  firstTransactionTs: number | null;
}
