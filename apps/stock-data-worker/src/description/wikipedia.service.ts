import { Injectable, Logger } from '@nestjs/common';

/**
 * Достаёт текстовое описание эмитента из русской Википедии.
 *
 * Главная сложность — НЕ источник, а корректное сопоставление бумаги со
 * статьёй (наивный заголовок «Озон» ведёт на «Озон Фармацевтика», а не на
 * маркетплейс OZON). Поэтому резолв заголовка идёт по приоритетам:
 *   1. курируемая мапа secid → точный заголовок ruwiki (топ-бумаги);
 *   2. фоллбэк: ISIN → Wikidata (P946) → sitelink ruwiki.
 * А затем — обязательная ВАЛИДАЦИЯ: если статья отсутствует или это
 * дизамбигуация, возвращаем null (лучше «нет описания», чем чужая компания).
 *
 * Берём плоский текст вводной секции (exintro + explaintext) — без HTML,
 * значит без рисков XSS на фронте.
 */

// Курируемая мапа для топ-бумаг MOEX. Заголовки — реальные статьи ruwiki
// (redirects=1 разрулит синонимы). Кривой/неоднозначный заголовок отсечётся
// валидацией, так что мапа безопасна даже при неточности.
const CURATED_RU_TITLES: Record<string, string> = {
  SBER: 'Сбербанк России',
  SBERP: 'Сбербанк России',
  GAZP: 'Газпром',
  LKOH: 'Лукойл',
  ROSN: 'Роснефть',
  NVTK: 'Новатэк',
  GMKN: 'Норникель',
  PLZL: 'Полюс (компания)',
  SIBN: 'Газпром нефть',
  YDEX: 'Яндекс',
  TATN: 'Татнефть',
  TATNP: 'Татнефть',
  VTBR: 'Банк ВТБ',
  OZON: 'Ozon',
  T: 'Т-Технологии',
  PHOR: 'Фосагро',
  SNGS: 'Сургутнефтегаз',
  SNGSP: 'Сургутнефтегаз',
  X5: 'X5',
  AKRN: 'Акрон (компания)',
  CHMF: 'Северсталь',
  MGNT: 'Магнит (компания)',
  MTSS: 'МТС',
  ALRS: 'Алроса',
  MOEX: 'Московская биржа',
  NLMK: 'Новолипецкий металлургический комбинат',
  RUAL: 'Русал',
  PIKK: 'ПИК (компания)',
  AFLT: 'Аэрофлот',
  HYDR: 'РусГидро',
  IRAO: 'Интер РАО',
  TRNFP: 'Транснефть',
  BANE: 'Башнефть',
  BANEP: 'Башнефть',
  MAGN: 'Магнитогорский металлургический комбинат',
  RTKM: 'Ростелеком',
  RTKMP: 'Ростелеком',
  AFKS: 'АФК «Система»',
  SMLT: 'Самолёт (группа компаний)',
  FLOT: 'Совкомфлот',
  POSI: 'Positive Technologies',
  UPRO: 'Юнипро',
  MSNG: 'Мосэнерго',
  LSRG: 'Группа ЛСР',
  ENPG: 'En+ Group',
  BSPB: 'Банк «Санкт-Петербург»',
  CBOM: 'Московский кредитный банк',
  VKCO: 'VK (компания)',
  SVCB: 'Совкомбанк',
  RENI: 'Группа Ренессанс Страхование',
  SOFL: 'Софтлайн (компания)',
  ASTR: 'Группа Астра',
  WUSH: 'Whoosh',
  SELG: 'Селигдар',
  MTLR: 'Мечел',
  MTLRP: 'Мечел',
};

// Wikipedia требует осмысленный User-Agent, иначе может отдать 403.
const USER_AGENT = 'WealthifyApp/1.0 (stock issuer descriptions)';
const MAX_LEN = 2500;

@Injectable()
export class WikipediaService {
  private readonly log = new Logger(WikipediaService.name);
  private readonly timeoutMs = 12_000;

  /**
   * Возвращает текстовое описание эмитента (ru) или null, если надёжно
   * сопоставить статью не удалось.
   */
  async getDescription(secid: string, isin?: string | null): Promise<string | null> {
    try {
      const title = await this.resolveTitle(secid, isin);
      if (!title) return null;
      return await this.fetchExtract(title);
    } catch (e) {
      this.log.warn(`getDescription(${secid}) failed: ${this.errMsg(e)}`);
      return null;
    }
  }

  // ───────────────────────── резолв заголовка ─────────────────────────

  private async resolveTitle(secid: string, isin?: string | null): Promise<string | null> {
    const curated = CURATED_RU_TITLES[secid.toUpperCase()];
    if (curated) return curated;
    if (isin) {
      const viaWikidata = await this.titleFromWikidataByIsin(isin);
      if (viaWikidata) return viaWikidata;
    }
    return null;
  }

  // ISIN → Wikidata-сущность (P946) → заголовок статьи ruwiki.
  private async titleFromWikidataByIsin(isin: string): Promise<string | null> {
    const searchUrl =
      `https://www.wikidata.org/w/api.php?action=query&list=search&format=json&formatversion=2` +
      `&srsearch=${encodeURIComponent(`haswbstatement:P946=${isin}`)}`;
    const search = await this.fetchJson<{ query?: { search?: Array<{ title: string }> } }>(searchUrl);
    const qid = search.query?.search?.[0]?.title;
    if (!qid) return null;

    const entUrl =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks` +
      `&ids=${encodeURIComponent(qid)}`;
    const ent = await this.fetchJson<{
      entities?: Record<string, { sitelinks?: { ruwiki?: { title?: string } } }>;
    }>(entUrl);
    return ent.entities?.[qid]?.sitelinks?.ruwiki?.title ?? null;
  }

  // ───────────────────────── получение текста ─────────────────────────

  private async fetchExtract(title: string): Promise<string | null> {
    const url =
      `https://ru.wikipedia.org/w/api.php?action=query&format=json&formatversion=2` +
      `&prop=extracts|pageprops&exintro=1&explaintext=1&redirects=1` +
      `&titles=${encodeURIComponent(title)}`;

    const data = await this.fetchJson<{
      query?: {
        pages?: Array<{
          missing?: boolean;
          extract?: string;
          pageprops?: { disambiguation?: string };
        }>;
      };
    }>(url);

    const page = data.query?.pages?.[0];
    if (!page || page.missing) return null;
    // дизамбигуация — это не описание компании
    if (page.pageprops && 'disambiguation' in page.pageprops) return null;

    const text = (page.extract ?? '').trim();
    if (text.length < 50) return null; // слишком коротко/мусор

    return this.clean(text);
  }

  // Чистим и подрезаем по границе предложения.
  private clean(text: string): string {
    let t = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (t.length > MAX_LEN) {
      const slice = t.slice(0, MAX_LEN);
      const lastDot = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.\n'));
      t = (lastDot > MAX_LEN * 0.5 ? slice.slice(0, lastDot + 1) : slice).trim() + ' …';
    }
    return t;
  }

  // ───────────────────────── утилиты ─────────────────────────

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for ${url}`);
    }
    return (await res.json()) as T;
  }

  private errMsg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
  }
}
