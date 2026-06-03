import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, Sequelize, literal } from 'sequelize';
import { AssetType } from '@libs/contracts';
import { rpcError } from '@libs/contracts/common';
import {
  RangeKey,
  Sparkline7D,
  StockCharts,
  StockData,
} from '@libs/contracts/stock-data-worker';
import {
  Asset,
  StockAssetCreationAttrs,
  StockAssetData,
  StockChartsData,
  StockChartsDataCreationAttrs,
} from '@libs/stock-data/models';
import { WikipediaService } from './description/wikipedia.service';
import { StockLogosService } from './logos/stock-logos.service';

// Производные, которые считаются по дневным свечам в charts-проходе и НЕ
// должны затираться частым snapshot-проходом.
export interface StockDerived {
  charts?: StockCharts;
  sparkline7D?: Sparkline7D | null;
  change7DPct?: number | null;
  change30DPct?: number | null;
  change1YPct?: number | null;
}

@Injectable()
export class StockDataWorkerService {
  private readonly log = new Logger(StockDataWorkerService.name);

  constructor(
    @InjectModel(StockAssetData)
    private readonly stockRepo: typeof StockAssetData,
    @InjectModel(StockChartsData)
    private readonly chartsRepo: typeof StockChartsData,
    @InjectModel(Asset)
    private readonly assetRepo: typeof Asset,
    @InjectConnection()
    private readonly sequelize: Sequelize,
    private readonly wikipedia: WikipediaService,
    private readonly logosService: StockLogosService,
  ) {}

  /**
   * Скачивает логотипы для бумаг без logoUrl и проставляет локальный путь.
   * Идемпотентно: уже скачанные/проставленные пропускаются. Для «префов»
   * (secid с хвостовой P) пробуем ещё и ISIN обыкновенной акции эмитента.
   */
  async backfillLogos(): Promise<void> {
    const rows = await this.stockRepo.findAll({
      attributes: ['id', 'secid', 'isin', 'logoUrl'],
    });

    const isinBySecid = new Map<string, string | null>();
    for (const r of rows) isinBySecid.set(r.secid, r.isin ?? null);

    let downloaded = 0;
    for (const row of rows) {
      if (row.logoUrl) continue;

      const ordinaryIsin =
        row.secid.endsWith('P') && isinBySecid.has(row.secid.slice(0, -1))
          ? isinBySecid.get(row.secid.slice(0, -1)) ?? null
          : null;

      const publicPath = await this.logosService.ensureLogo(
        row.secid,
        row.isin,
        ordinaryIsin,
      );
      if (publicPath) {
        await row
          .update({ logoUrl: publicPath })
          .catch((e) => this.log.warn(`logo set failed ${row.secid}: ${e?.message ?? e}`));
        downloaded += 1;
      }
      await new Promise((r) => setTimeout(r, 80)); // не спамим источники
    }

    this.log.log(`Logo backfill done: ${downloaded} new logos`);
  }

  health() {
    return { ok: true, time: new Date().toISOString() };
  }

  /**
   * Текстовое описание эмитента. Lazy-кеш: первый запрос тянет из Википедии и
   * сохраняет в БД, дальше — мгновенно. Если статьи нет — помечаем
   * descriptionCheckedAt и не дёргаем Википедию снова ~неделю.
   */
  async getDescription(ticker: string): Promise<{ description: string | null }> {
    const secid = this.normalizeTicker(ticker);

    const row = await this.stockRepo.findOne({
      where: { secid },
      attributes: ['id', 'secid', 'isin', 'description', 'descriptionCheckedAt'],
    });
    if (!row) {
      rpcError(HttpStatus.NOT_FOUND, 'ASSET_NOT_FOUND', `Stock with ticker ${secid} not found`);
    }

    if (row.description) {
      return { description: row.description };
    }

    // не долбим Википедию по бумагам без статьи чаще раза в неделю
    const RECHECK_TTL = 7 * 24 * 60 * 60 * 1000;
    if (
      row.descriptionCheckedAt &&
      Date.now() - new Date(row.descriptionCheckedAt).getTime() < RECHECK_TTL
    ) {
      return { description: null };
    }

    const text = await this.wikipedia.getDescription(row.secid, row.isin);

    await row
      .update({ description: text ?? null, descriptionCheckedAt: new Date() })
      .catch((e) => this.log.warn(`getDescription save failed for ${secid}: ${e?.message ?? e}`));

    return { description: text ?? null };
  }

  // ───────────────────────── ЧТЕНИЕ ─────────────────────────

  async getAssetByTicker(ticker: string) {
    const secid = this.normalizeTicker(ticker);

    const row = await this.stockRepo.findOne({
      where: { secid },
      include: [{ model: this.assetRepo, required: false }],
    });

    if (!row) {
      rpcError(HttpStatus.NOT_FOUND, 'ASSET_NOT_FOUND', `Stock with ticker ${secid} not found`);
    }

    // id === assetId (PK таблицы assets) — так же, как в crypto: favorites и
    // /favorites/* работают именно с этим id.
    return {
      id: row.assetId,
      assetId: row.assetId,
      secid: row.secid,
      ticker: row.secid,
      name: row.name,
      shortName: row.shortName,
      type: AssetType.STOCK,
      boardId: row.boardId ?? null,
      isin: row.isin ?? null,
      currency: row.currency ?? null,
      lotSize: row.lotSize ?? null,
      issueSize: row.issueSize ?? null,
      faceValue: row.faceValue ?? null,
      listLevel: row.listLevel ?? null,
      logoUrl: row.logoUrl ?? null,
      rank: row.rank ?? null,
      currentPrice: row.currentPrice ?? null,
      prevPrice: row.prevPrice ?? null,
      openPrice: row.openPrice ?? null,
      highPrice: row.highPrice ?? null,
      lowPrice: row.lowPrice ?? null,
      dayChangePct: row.dayChangePct ?? null,
      change7DPct: row.change7DPct ?? null,
      change30DPct: row.change30DPct ?? null,
      change1YPct: row.change1YPct ?? null,
      marketCap: row.marketCap ?? null,
      valueToday: row.valueToday ?? null,
      volumeToday: row.volumeToday ?? null,
      numTrades: row.numTrades ?? null,
      sparkline7D: row.sparkline7D ?? null,
      lastUpdatedAt: row.lastUpdatedAt ?? null,
    };
  }

  async listAssets(params?: { limit?: number; offset?: number }) {
    const limit =
      params?.limit && params.limit > 0 && params.limit <= 200 ? params.limit : 50;
    const offset = params?.offset && params.offset >= 0 ? params.offset : 0;

    const { rows, count } = await this.stockRepo.findAndCountAll({
      limit,
      offset,
      // rank ASC → в PG NULL'ы уходят в конец по умолчанию (нужное поведение:
      // бумаги без капитализации внизу списка).
      order: [['rank', 'ASC']],
      attributes: [
        'id',
        'assetId',
        'secid',
        'name',
        'shortName',
        'isin',
        'currency',
        'logoUrl',
        'rank',
        'currentPrice',
        'prevPrice',
        'dayChangePct',
        'change7DPct',
        'change30DPct',
        'change1YPct',
        'marketCap',
        'valueToday',
        'volumeToday',
        'sparkline7D',
        'lastUpdatedAt',
      ],
    });

    const items = rows.map((row) => ({
      id: row.assetId,
      secid: row.secid,
      ticker: row.secid,
      name: row.name,
      shortName: row.shortName,
      type: AssetType.STOCK,
      isin: row.isin ?? null,
      currency: row.currency ?? null,
      logoUrl: row.logoUrl ?? null,
      rank: row.rank ?? null,
      currentPrice: row.currentPrice ?? null,
      prevPrice: row.prevPrice ?? null,
      dayChangePct: row.dayChangePct ?? null,
      change7DPct: row.change7DPct ?? null,
      change30DPct: row.change30DPct ?? null,
      change1YPct: row.change1YPct ?? null,
      marketCap: row.marketCap ?? null,
      valueToday: row.valueToday ?? null,
      volumeToday: row.volumeToday ?? null,
      sparkline7D: row.sparkline7D ?? null,
      lastUpdatedAt: row.lastUpdatedAt ?? null,
    }));

    return { items, total: count, limit, offset };
  }

  async getChartsByTicker(ticker: string) {
    const secid = this.normalizeTicker(ticker);

    const row = await this.stockRepo.findOne({
      where: { secid },
      include: [{ model: this.chartsRepo, required: false }],
    });

    if (!row) {
      rpcError(HttpStatus.NOT_FOUND, 'ASSET_NOT_FOUND', `Stock with ticker ${secid} not found`);
    }

    return row.charts ?? null;
  }

  async searchAssets(params: { query: string; limit?: number }) {
    const rawQuery = params.query?.trim();
    if (!rawQuery) return { items: [] };

    const limit =
      params.limit && params.limit > 0 && params.limit <= 50 ? params.limit : 10;

    const ilike = `%${rawQuery}%`;

    const rows = await this.stockRepo.findAll({
      limit,
      where: {
        [Op.or]: [
          { secid: { [Op.iLike]: ilike } },
          { shortName: { [Op.iLike]: ilike } },
          { name: { [Op.iLike]: ilike } },
          { isin: { [Op.iLike]: ilike } },
        ],
      },
      // Точное совпадение тикера → выше; затем по рангу. Пользовательский
      // ввод идёт через replacements (Sequelize экранирует) — без SQL-инъекций.
      order: [
        [
          literal(`CASE
            WHEN "StockAssetData"."secid" ILIKE :exact THEN 0
            WHEN "StockAssetData"."secid" ILIKE :prefix THEN 1
            ELSE 2
          END`),
          'ASC',
        ],
        ['rank', 'ASC'],
      ],
      replacements: { exact: rawQuery, prefix: `${rawQuery}%` },
      attributes: [
        'id',
        'assetId',
        'secid',
        'name',
        'shortName',
        'currency',
        'logoUrl',
        'rank',
        'currentPrice',
        'dayChangePct',
        'marketCap',
      ],
    });

    const items = rows.map((row) => ({
      id: row.assetId,
      secid: row.secid,
      ticker: row.secid,
      name: row.name,
      shortName: row.shortName,
      type: AssetType.STOCK,
      currency: row.currency ?? null,
      logoUrl: row.logoUrl ?? null,
      rank: row.rank ?? null,
      currentPrice: row.currentPrice ?? null,
      dayChangePct: row.dayChangePct ?? null,
      marketCap: row.marketCap ?? null,
    }));

    return { items };
  }

  // ───────────────────────── ЗАПИСЬ ─────────────────────────

  /**
   * Возвращает все отслеживаемые secid — нужно charts-проходу, чтобы знать,
   * по каким бумагам тянуть свечи (только по тем, у кого уже есть снапшот).
   */
  async listTrackedSecids(): Promise<string[]> {
    // Порядок по рангу (капитализации) — charts-проход обрабатывает сначала
    // топовые бумаги, чтобы верх списка на фронте заполнялся графиками раньше.
    // NULL-ранги уходят в конец (поведение PG по умолчанию для ASC).
    const rows = await this.stockRepo.findAll({
      attributes: ['secid'],
      order: [['rank', 'ASC']],
    });
    return rows.map((r) => r.secid);
  }

  /**
   * Upsert снапшота: цена / дневное изменение / капитализация / ранг / объём.
   * НЕ трогает производные (change7D/30D/1Y, sparkline, charts) — их владеет
   * charts-проход (saveDerivedAndCharts). Идентити-ключ — secid.
   */
  async upsertSnapshot(data: StockData): Promise<number> {
    if (!data.secid) {
      throw new Error('upsertSnapshot: missing secid');
    }

    return this.sequelize.transaction(async (t) => {
      const assetName = data.name || data.shortName || data.secid;

      const [asset, createdAsset] = await this.assetRepo.findOrCreate({
        where: { slug: data.secid },
        defaults: {
          name: assetName,
          ticker: data.secid,
          type: AssetType.STOCK,
          slug: data.secid,
        },
        transaction: t,
      });
      if (!createdAsset) {
        asset.set({ name: assetName, ticker: data.secid });
        await asset.save({ transaction: t });
      }

      const attrs = this.mapSnapshotAttrs(data, asset.id);

      const [row, createdRow] = await this.stockRepo.findOrCreate({
        where: { secid: data.secid },
        defaults: attrs,
        transaction: t,
      });
      if (!createdRow) {
        row.set(attrs);
        await row.save({ transaction: t });
      }

      return row.id;
    });
  }

  /**
   * Сохраняет графики + производные (sparkline, change7D/30D/1Y). Если снапшота
   * ещё нет (charts-проход обогнал snapshot) — тихо выходим: создавать stock без
   * рыночных полей смысла нет, следующий snapshot его заведёт.
   */
  async saveDerivedAndCharts(secid: string, derived: StockDerived): Promise<void> {
    const row = await this.stockRepo.findOne({ where: { secid } });
    if (!row) {
      this.log.debug(`saveDerivedAndCharts: snapshot for ${secid} not found yet, skipping`);
      return;
    }

    await this.sequelize.transaction(async (t) => {
      // Обновляем только переданные производные; undefined не затирает прежнее.
      const patch: Partial<StockAssetCreationAttrs> = {};
      if (derived.change7DPct !== undefined) patch.change7DPct = derived.change7DPct;
      if (derived.change30DPct !== undefined) patch.change30DPct = derived.change30DPct;
      if (derived.change1YPct !== undefined) patch.change1YPct = derived.change1YPct;
      if (derived.sparkline7D !== undefined) patch.sparkline7D = derived.sparkline7D;
      if (Object.keys(patch).length > 0) {
        row.set(patch);
        await row.save({ transaction: t });
      }

      if (derived.charts) {
        const chartsAttrs = this.mapChartsToColumns(derived.charts);
        const existing = await this.chartsRepo.findOne({
          where: { assetDataId: row.id },
          transaction: t,
        });
        if (!existing) {
          await this.chartsRepo.create(
            { assetDataId: row.id, ...chartsAttrs, capturedAt: new Date() },
            { transaction: t },
          );
        } else {
          existing.set({ ...chartsAttrs, capturedAt: new Date() });
          await existing.save({ transaction: t });
        }
      }
    });
  }

  // ───────────────────────── мапперы ─────────────────────────

  private mapSnapshotAttrs(data: StockData, assetId: number): StockAssetCreationAttrs {
    return {
      secid: data.secid,
      shortName: data.shortName || data.secid,
      name: data.name || data.shortName || data.secid,
      assetId,

      boardId: data.boardId ?? null,
      isin: data.isin ?? null,
      currency: data.currency ?? null,
      lotSize: data.lotSize ?? null,
      issueSize: data.issueSize ?? null,
      faceValue: data.faceValue ?? null,
      listLevel: data.listLevel ?? null,

      rank: data.rank ?? null,
      currentPrice: data.currentPrice ?? null,
      prevPrice: data.prevPrice ?? null,
      openPrice: data.openPrice ?? null,
      highPrice: data.highPrice ?? null,
      lowPrice: data.lowPrice ?? null,

      dayChangePct: data.dayChangePct ?? null,

      marketCap: data.marketCap ?? null,
      valueToday: data.valueToday ?? null,
      volumeToday: data.volumeToday ?? null,
      numTrades: data.numTrades ?? null,

      lastUpdatedAt: new Date(),
    };
  }

  private mapChartsToColumns(charts: StockCharts): Partial<StockChartsDataCreationAttrs> {
    const get = (range: RangeKey, key: 'stats' | 'total_volumes') => charts?.[range]?.[key];
    return {
      h24Stats: get('h24', 'stats'),
      h24Volumes: get('h24', 'total_volumes'),
      d7Stats: get('d7', 'stats'),
      d7Volumes: get('d7', 'total_volumes'),
      d30Stats: get('d30', 'stats'),
      d30Volumes: get('d30', 'total_volumes'),
      d90Stats: get('d90', 'stats'),
      d90Volumes: get('d90', 'total_volumes'),
      d365Stats: get('d365', 'stats'),
      d365Volumes: get('d365', 'total_volumes'),
      maxStats: get('max', 'stats'),
      maxVolumes: get('max', 'total_volumes'),
    };
  }

  private normalizeTicker(ticker: string): string {
    return (ticker ?? '').trim().toUpperCase();
  }
}
