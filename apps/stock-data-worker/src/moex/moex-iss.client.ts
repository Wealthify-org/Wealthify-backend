import { Injectable, Logger } from '@nestjs/common';

/**
 * Тонкий клиент к MOEX ISS API (https://iss.moex.com).
 *
 * ISS отдаёт данные в "колоночном" формате:
 *   { "securities": { "columns": ["SECID", ...], "data": [["SBER", ...], ...] } }
 * поэтому здесь же лежит хелпер `tableToObjects`, который зипует columns+data
 * в обычные объекты.
 *
 * Данные бесплатны и не требуют авторизации (котировки идут с задержкой ~15
 * минут — для портфельного трекера это некритично). Реалтайм/стакан — платные,
 * мы их не используем.
 */

// Доска (режим торгов) основных акций: «Т+ Акции и ДР».
export const MOEX_SHARES_BOARD = 'TQBR';
const MOEX_ENGINE = 'stock';
const MOEX_MARKET = 'shares';

const ISS_BASE = 'https://iss.moex.com/iss';

// Сырой блок ISS (columns + data).
interface MoexBlock {
  columns: string[];
  data: Array<Array<string | number | null>>;
}

export type MoexRow = Record<string, string | number | null>;

export interface MoexCandle {
  open: number | null;
  close: number | null;
  high: number | null;
  low: number | null;
  value: number | null; // оборот в рублях
  volume: number | null; // объём в штуках
  begin: string | null; // 'YYYY-MM-DD HH:mm:ss'
  end: string | null;
}

// MOEX-интервалы свечей.
export type MoexInterval =
  | 1 // 1 минута
  | 10 // 10 минут
  | 60 // 1 час
  | 24 // 1 день
  | 7 // 1 неделя
  | 31; // 1 месяц

@Injectable()
export class MoexIssClient {
  private readonly log = new Logger(MoexIssClient.name);

  // Таймаут одного HTTP-запроса. MOEX обычно отвечает быстро, но защищаемся
  // от зависаний — иначе cron мог бы залипнуть навсегда.
  private readonly requestTimeoutMs = 15_000;
  // Кол-во ретраев на временные ошибки (5xx / сеть / таймаут).
  private readonly maxRetries = 2;

  // ───────────────────────── низкоуровневый fetch ─────────────────────────

  private buildUrl(path: string, query: Record<string, string | number | undefined>): string {
    const usp = new URLSearchParams();
    // iss.meta=off убирает тяжёлый блок метаданных (описание типов колонок).
    usp.set('iss.meta', 'off');
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') usp.set(k, String(v));
    }
    return `${ISS_BASE}${path}?${usp.toString()}`;
  }

  private async fetchJson<T = Record<string, MoexBlock>>(
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = this.buildUrl(path, query);

    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });

        if (!res.ok) {
          // 5xx — ретраим, 4xx — нет (ошибка запроса не исправится повтором).
          const body = await res.text().catch(() => '');
          const err = new Error(`MOEX HTTP ${res.status} for ${url}: ${body.slice(0, 200)}`);
          if (res.status >= 500 && attempt < this.maxRetries) {
            lastErr = err;
            await this.sleep(400 * (attempt + 1));
            continue;
          }
          throw err;
        }

        return (await res.json()) as T;
      } catch (e) {
        lastErr = e;
        const isAbort = e instanceof Error && e.name === 'TimeoutError';
        const retriable = isAbort || (e instanceof Error && /ECONN|ETIMEDOUT|ENOTFOUND|fetch failed|network/i.test(e.message));
        if (retriable && attempt < this.maxRetries) {
          await this.sleep(400 * (attempt + 1));
          continue;
        }
        throw e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }

  // Зипуем колоночный блок ISS в массив объектов.
  private tableToObjects(block?: MoexBlock): MoexRow[] {
    if (!block || !Array.isArray(block.columns) || !Array.isArray(block.data)) {
      return [];
    }
    const cols = block.columns;
    return block.data.map((row) => {
      const obj: MoexRow = {};
      for (let i = 0; i < cols.length; i += 1) {
        obj[cols[i]] = row[i] ?? null;
      }
      return obj;
    });
  }

  // ───────────────────────── публичные методы ─────────────────────────

  /**
   * Список акций доски TQBR с объединёнными статикой (securities) и рыночными
   * данными (marketdata). Join по SECID. Пагинируем через `start`, пока не
   * закончатся строки.
   */
  async fetchBoardSecurities(): Promise<MoexRow[]> {
    const path = `/engines/${MOEX_ENGINE}/markets/${MOEX_MARKET}/boards/${MOEX_SHARES_BOARD}/securities.json`;

    const result: MoexRow[] = [];
    const seen = new Set<string>();
    const pageSize = 100;
    const maxPages = 50; // страховка от бесконечного цикла

    for (let page = 0; page < maxPages; page += 1) {
      const start = page * pageSize;
      const json = await this.fetchJson<Record<string, MoexBlock>>(path, { start });

      const securities = this.tableToObjects(json.securities);
      if (securities.length === 0) break;

      // marketdata той же страницы — кладём в map по SECID для join'а.
      const marketBySecid = new Map<string, MoexRow>();
      for (const md of this.tableToObjects(json.marketdata)) {
        const secid = typeof md.SECID === 'string' ? md.SECID : null;
        if (secid) marketBySecid.set(secid, md);
      }

      // Дедуп по SECID. ВАЖНО: этот endpoint MOEX игнорирует `start` и каждый
      // раз отдаёт ВЕСЬ список целиком (проверено: start=0/100/200 → одни и те
      // же 262 бумаги). Без дедупа наивная пагинация плодила бы дубликаты.
      let added = 0;
      for (const sec of securities) {
        const secid = typeof sec.SECID === 'string' ? sec.SECID : null;
        if (!secid || seen.has(secid)) continue;
        seen.add(secid);
        added += 1;
        // marketdata НЕ затирает статику (ключи не пересекаются кроме
        // SECID/BOARDID, которые совпадают).
        result.push({ ...sec, ...(marketBySecid.get(secid) ?? {}) });
      }

      // Нет новых бумаг → пагинации нет (endpoint вернул весь список повторно)
      // или она закончилась. Останавливаемся.
      if (added === 0) break;
      if (securities.length < pageSize) break;

      await this.sleep(120);
    }

    return result;
  }

  /**
   * Свечи по инструменту. Пагинируем по `start` пачками по 500 (лимит ISS).
   * `from`/`till` — даты вида 'YYYY-MM-DD'.
   */
  async fetchCandles(
    secid: string,
    opts: { interval: MoexInterval; from: string; till?: string },
  ): Promise<MoexCandle[]> {
    const path = `/engines/${MOEX_ENGINE}/markets/${MOEX_MARKET}/securities/${encodeURIComponent(
      secid,
    )}/candles.json`;

    const result: MoexCandle[] = [];
    const pageSize = 500;
    const maxPages = 60; // 60 * 500 = 30k свечей — с запасом на дневной max

    for (let page = 0; page < maxPages; page += 1) {
      const start = page * pageSize;
      const json = await this.fetchJson<Record<string, MoexBlock>>(path, {
        interval: opts.interval,
        from: opts.from,
        till: opts.till,
        start,
      });

      const rows = this.tableToObjects(json.candles);
      if (rows.length === 0) break;

      for (const r of rows) {
        result.push({
          open: this.num(r.open),
          close: this.num(r.close),
          high: this.num(r.high),
          low: this.num(r.low),
          value: this.num(r.value),
          volume: this.num(r.volume),
          begin: typeof r.begin === 'string' ? r.begin : null,
          end: typeof r.end === 'string' ? r.end : null,
        });
      }

      if (rows.length < pageSize) break;
      await this.sleep(120);
    }

    return result;
  }

  // ───────────────────────── утилиты ─────────────────────────

  // Безопасный парс числа из ISS: null/''/нечисло → null.
  private num(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
