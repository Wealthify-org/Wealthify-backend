import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Скачивает логотипы акций и складывает их статикой на наш бэк
 * (LOGOS_STORAGE_DIR/stocks/<SECID>.png, раздаётся gateway'ем под
 * LOGOS_PUBLIC_PREFIX). Так мы не зависим от чужого CDN в рантайме и можем
 * добивать промахи из нескольких источников.
 *
 * Источники по приоритету:
 *   1. CDN Т-Инвестиций по ISIN бумаги (x320 → x160) — настоящие лого, ~3/4;
 *   2. CDN Т-Инвестиций по ISIN обыкновенной акции того же эмитента (для «префов»);
 *   3. Google S2 favicon по домену компании (курируемая мапа) — добивает
 *      крупные имена, у которых новый ISIN ещё не лёг в CDN (OZON, X5, VK…).
 */

const TINKOFF_CDN = 'https://invest-brands.cdn-tinkoff.ru';

// Домены крупных бумаг, которых нет в CDN Т-Инвестиций по ISIN.
const CURATED_DOMAINS: Record<string, string> = {
  OZON: 'ozon.ru',
  T: 'tbank.ru',
  X5: 'x5.ru',
  RUAL: 'rusal.ru',
  DOMRF: 'domrf.ru',
  SVCB: 'sovcombank.ru',
  ENPG: 'enplusgroup.com',
  LENT: 'lenta.com',
  FLOT: 'scf.ru',
  VKCO: 'vk.com',
  HEAD: 'hh.ru',
  RAGR: 'rusagrogroup.ru',
  VEON: 'veon.com',
  'VEON-RX': 'veon.com',
  MDMG: 'mcclinics.ru',
  PRMD: 'promomed.ru',
  LEAS: 'europlan.ru',
  SGZH: 'segezha-group.com',
  GEMC: 'emcmos.ru',
  OZPH: 'ozonpharm.ru',
  FIXR: 'fix-price.com',
  CNRU: 'cian.ru',
  ASTR: 'astra.ru',
  RENI: 'renins.ru',
  MBNK: 'mtsbank.ru',
  SOFL: 'softline.ru',
  WUSH: 'whoosh-bike.ru',
  DELI: 'delimobil.ru',
  ZAYM: 'zaymer.ru',
  ABRD: 'absolutgroup.ru',
};

@Injectable()
export class StockLogosService {
  private readonly log = new Logger(StockLogosService.name);

  constructor(private readonly config: ConfigService) {}

  private get baseDir(): string {
    return (
      this.config.get<string>('LOGOS_STORAGE_DIR') ??
      path.resolve(process.cwd(), 'storage', 'logos')
    );
  }

  private get publicPrefix(): string {
    return this.config.get<string>('LOGOS_PUBLIC_PREFIX') ?? '/static/logos';
  }

  private get stocksDir(): string {
    return path.join(this.baseDir, 'stocks');
  }

  /**
   * Гарантирует наличие локального логотипа для бумаги. Возвращает публичный
   * путь (/static/logos/stocks/<SECID>.png) или null, если ни один источник не
   * дал картинку.
   */
  async ensureLogo(
    secid: string,
    isin?: string | null,
    ordinaryIsin?: string | null,
  ): Promise<string | null> {
    const sec = secid.toUpperCase();
    const publicPath = `${this.publicPrefix}/stocks/${sec}.png`;
    const filePath = path.join(this.stocksDir, `${sec}.png`);

    // уже скачан
    if (await this.fileExists(filePath)) return publicPath;

    const urls: string[] = [];
    if (isin) {
      urls.push(`${TINKOFF_CDN}/${isin}x320.png`, `${TINKOFF_CDN}/${isin}x160.png`);
    }
    if (ordinaryIsin && ordinaryIsin !== isin) {
      urls.push(`${TINKOFF_CDN}/${ordinaryIsin}x320.png`, `${TINKOFF_CDN}/${ordinaryIsin}x160.png`);
    }
    const domain = CURATED_DOMAINS[sec];
    if (domain) {
      urls.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    }

    for (const url of urls) {
      const buf = await this.tryDownload(url);
      if (buf) {
        try {
          await fs.mkdir(this.stocksDir, { recursive: true });
          await fs.writeFile(filePath, buf);
          return publicPath;
        } catch (e) {
          this.log.warn(`save logo ${sec} failed: ${this.errMsg(e)}`);
          return null;
        }
      }
    }

    return null;
  }

  // ───────────────────────── утилиты ─────────────────────────

  private async tryDownload(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WealthifyApp/1.0 (stock logos)' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.startsWith('image/')) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      // отсекаем «пустышки»/заглушки
      if (buf.byteLength < 100) return null;
      return buf;
    } catch {
      return null;
    }
  }

  private async fileExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private errMsg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }
}
