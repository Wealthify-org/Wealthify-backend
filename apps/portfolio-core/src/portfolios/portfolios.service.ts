import { HttpStatus, Injectable, Inject, Logger } from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/sequelize";
import { ClientProxy } from "@nestjs/microservices";
import { catchError, lastValueFrom, of, timeout } from "rxjs";
import { Sequelize } from "sequelize-typescript";

/** Таймаут для RPC до соседнего микросервиса. Без него каждый зависший
 *  peer (assets / identity) блокирует HTTP-запрос в gateway навсегда. */
const RPC_TIMEOUT_MS = 5_000;

const rpcLog = new Logger('PortfoliosService.RPC');

import { Portfolio } from "./portfolios.model";
import { AssetType, CreatePortfolioDto } from "@libs/contracts";
import { PortfolioAssets } from "../portfolio-assets/portfolio-assets.model";
import { Transaction } from "../transactions/transactions.model";
import { QueryTypes } from "sequelize";
import { FxService } from "./fx.service";
import { rpcError } from "@libs/contracts/common";
import { PortfolioType } from "@libs/contracts/common/enums/portfolio-type.enum";
import { UserPortfoliosSummaryDto } from "@libs/contracts/portfolios/dto/user-portfolios-summary.dto";
import { ASSETS_CLIENT } from "./portfolio.constants";
import { ASSETS_PATTERNS } from "@libs/contracts/assets/assets.pattern";
import { getAssetCategoryIds } from "@libs/contracts/crypto-data-worker";

// Поддерживаемые валюты отображения и их символы.
const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", RUB: "₽" };
const normalizeCurrency = (c?: string | null): string =>
  c && CURRENCY_SYMBOLS[c.toUpperCase()] ? c.toUpperCase() : "USD";

// Цена акции, прочитанная сырым SQL из stock_assets (рубли).
interface StockRow {
  assetId: number;
  currentPrice: number | null;
  dayChangePct: number | null;
  currency: string | null;
  logoUrl: string | null;
  sparkline7D: { prices?: number[] | null } | null;
}

// локальный тип того, что вернёт сервис активов
interface AssetWithData {
  id: number;
  ticker: string;
  name?: string;
  type: AssetType;
  assetData?: {
    currentPriceUsd?: number | null;
    change24HUsdPct?: number | null;
    logoUrlLocal?: string | null;
    categories?: string | null;
    sparkline7D?: { prices?: number[] | null } | null;
  };
}

@Injectable()
export class PortfoliosService {
  constructor(
    @InjectModel(Portfolio)
    private readonly portfolioRepository: typeof Portfolio,
    @InjectModel(PortfolioAssets)
    private readonly portfolioAssetsRepository: typeof PortfolioAssets,
    @InjectModel(Transaction)
    private readonly transactionRepository: typeof Transaction,
    @Inject(ASSETS_CLIENT)
    private readonly assetsClient: ClientProxy,
    private readonly fx: FxService,
    @InjectConnection()
    private readonly sequelize: Sequelize,
  ) {}

  async createPortfolio(dto: CreatePortfolioDto) {
    const exists = await this.portfolioRepository.findOne({
      where: { userId: dto.userId, name: dto.name },
    });
    if (exists) {
      rpcError(
        HttpStatus.CONFLICT,
        "PORTFOLIO_EXISTS",
        `Portfolio "${dto.name}" already exists`,
      );
    }
    // Валюта по умолчанию: Stock-портфель → рубли, иначе доллары.
    // Пользователь может сменить через setDisplayCurrency.
    const displayCurrency =
      normalizeCurrency(dto.displayCurrency) !== "USD"
        ? normalizeCurrency(dto.displayCurrency)
        : dto.type === PortfolioType.STOCK
          ? "RUB"
          : "USD";

    return this.portfolioRepository.create({ ...dto, displayCurrency });
  }

  /** Меняет валюту отображения портфеля (USD/RUB). */
  async setDisplayCurrency(portfolioId: number, userId: number, currency: string) {
    const portfolio = await this.portfolioRepository.findByPk(portfolioId, {
      attributes: ["id", "userId"],
    });
    if (!portfolio) {
      rpcError(HttpStatus.NOT_FOUND, "PORTFOLIO_NOT_FOUND", `Portfolio ${portfolioId} not found`);
    }
    if (portfolio.userId !== userId) {
      rpcError(HttpStatus.FORBIDDEN, "PORTFOLIO_FORBIDDEN", `Portfolio ${portfolioId} doesn't belong to user`);
    }
    const cur = normalizeCurrency(currency);
    await portfolio.update({ displayCurrency: cur });
    return { id: portfolioId, displayCurrency: cur };
  }

  // Карта цен акций по assetId (рубли) — для оценки Stock-позиций без RPC.
  // ВАЖНО: читаем сырым SQL, а НЕ через Sequelize-модель, чтобы portfolio-core
  // не регистрировал модель на таблицу stock_assets (его sync:{alter:true}
  // снёс бы недостающие в модели колонки — таблицей владеет stock-data-worker).
  private async getStockPriceMap(assetIds: number[]): Promise<Map<number, StockRow>> {
    if (!assetIds.length) return new Map();
    let rows: StockRow[] = [];
    try {
      rows = (await this.sequelize.query(
        `SELECT "assetId", "currentPrice", "dayChangePct", "currency", "logoUrl", "sparkline7D"
         FROM "stock_assets" WHERE "assetId" IN (:ids)`,
        { replacements: { ids: assetIds }, type: QueryTypes.SELECT },
      )) as StockRow[];
    } catch (e) {
      rpcLog.warn(`stock price query failed: ${(e as Error)?.message ?? e}`);
      return new Map();
    }
    const map = new Map<number, StockRow>();
    for (const r of rows) {
      if (r.assetId != null) map.set(Number(r.assetId), r);
    }
    return map;
  }

  /**
   * Цена позиции В ДОЛЛАРАХ + дневное изменение + (опц.) спарклайн в USD.
   * Крипта — currentPriceUsd как есть; FIAT USD — 1; акция — рублёвая цена /
   * курс. Возвращает null, если цены нет (позицию пропускаем).
   */
  private resolveUsd(
    asset: AssetWithData,
    stock: StockRow | undefined,
    rubPerUsd: number,
  ): { priceUsd: number; change24: number; sparkUsd: number[] | null } | null {
    if (asset.type === AssetType.FIAT && asset.ticker === "USD") {
      return { priceUsd: 1, change24: 0, sparkUsd: null };
    }
    const data = asset.assetData;

    // Stock-актив — оцениваем по рублёвой цене ЯВНО по типу (не полагаемся на
    // отсутствие crypto-цены), затем переводим в USD по курсу.
    const stockUsd =
      stock && stock.currentPrice != null && rubPerUsd > 0
        ? {
            priceUsd: stock.currentPrice / rubPerUsd,
            change24: stock.dayChangePct ?? 0,
            sparkUsd: stock.sparkline7D?.prices
              ? stock.sparkline7D.prices.map((p) => p / rubPerUsd)
              : null,
          }
        : null;

    if (asset.type === AssetType.STOCK && stockUsd) {
      return stockUsd;
    }
    if (data?.currentPriceUsd != null) {
      return {
        priceUsd: data.currentPriceUsd,
        change24: data.change24HUsdPct ?? 0,
        sparkUsd: data.sparkline7D?.prices ?? null,
      };
    }
    // фолбэк: цены из stock_assets есть, но тип не Stock (легаси) — используем
    if (stockUsd) return stockUsd;
    return null;
  }

  private async getAssetsMapByIds(
    assetIds: number[],
  ): Promise<Map<number, AssetWithData>> {
    if (!assetIds.length) return new Map();

    // RPC c timeout — раньше зависший assets-MS навсегда блокировал
    // page-load. Теперь через 5с возвращаем пустой массив (UI покажет
    // позиции с нулевой стоимостью вместо вечной загрузки), но логируем
    // ошибку.
    const assets =
      (await lastValueFrom(
        this.assetsClient
          .send<AssetWithData[]>(ASSETS_PATTERNS.GET_MANY_BY_IDS, {
            ids: assetIds,
          })
          .pipe(
            timeout(RPC_TIMEOUT_MS),
            catchError((err) => {
              rpcLog.error(
                `assets-MS GET_MANY_BY_IDS failed: ${(err as Error)?.message ?? err}`,
              );
              return of<AssetWithData[]>([]);
            }),
          ),
      )) ?? [];

    const map = new Map<number, AssetWithData>();
    for (const asset of assets) {
      map.set(asset.id, asset);
    }
    return map;
  }

  async getAllPortfolios(userId: number) {
    // Один запрос вместо двух: подтягиваем portfolio + positions через include.
    // Раньше было findAll(portfolios) → findAll(portfolio_assets where IN ids).
    const portfolios = await this.portfolioRepository.findAll({
      where: { userId },
      include: [{ model: PortfolioAssets, required: false }],
    });

    if (portfolios.length === 0) {
      return {
        portfolios: [],
        valuesUsd: [],
        change24hAbsUsd: [],
        change24hPct: [],
        values: [],
        change24hAbs: [],
        currencies: [],
        sparklines7d: [],
      };
    }

    // Все portfolio_assets из всех портфелей собираем в плоский массив
    const rows: PortfolioAssets[] = portfolios.flatMap(
      (p) => ((p as any).portfolioAssets as PortfolioAssets[]) ?? [],
    );

    const assetIds = Array.from(
      new Set(rows.map((row) => row.assetId).filter((id): id is number => !!id)),
    );

    const [assetsMap, stockMap, rubPerUsd] = await Promise.all([
      this.getAssetsMapByIds(assetIds),
      this.getStockPriceMap(assetIds),
      this.fx.getRubPerUsd(),
    ]);

    // тип каждого портфеля — для фильтра "только активы своего типа"
    const portfolioTypeById = new Map<number, string>(
      portfolios.map((p) => [p.id, String(p.type)]),
    );

    const byPortfolio = new Map<
      number,
      {
        totalNow: number;
        total24hAgo: number;
        // Sparkline-серия портфеля: для каждого индекса i накапливаем
        // sum(asset.sparkline7D.prices[i] * quantity). Длина итоговой
        // серии — минимальная среди всех активов портфеля (берём по
        // самому короткому ряду, чтобы не было undefined).
        sparkline: number[];
        sparklineLen: number;
      }
    >();

    for (const row of rows) {
      const portfolioId = row.portfolioId;
      const quantity = row.quantity;
      if (!quantity || quantity <= 0) continue;

      const asset = assetsMap.get(row.assetId);
      if (!asset) continue;

      // только активы своего типа (легаси-несоответствия не считаем)
      const pType = portfolioTypeById.get(portfolioId);
      if (pType && String(asset.type) !== pType && asset.type !== AssetType.FIAT) {
        continue;
      }

      // priceNow — В ДОЛЛАРАХ (крипта/USD как есть, акции пересчитаны из рублей).
      const resolved = this.resolveUsd(asset, stockMap.get(row.assetId), rubPerUsd);
      if (!resolved) continue;
      const priceNow = resolved.priceUsd;
      const change24 = resolved.change24;

      const valueNow = quantity * priceNow;
      let value24hAgo: number;

      if (!change24) {
        value24hAgo = valueNow;
      } else {
        const denom = 1 + change24 / 100;
        value24hAgo = denom <= 0 ? 0 : quantity * (priceNow / denom);
      }

      const bucket =
        byPortfolio.get(portfolioId) ?? {
          totalNow: 0,
          total24hAgo: 0,
          sparkline: [],
          sparklineLen: Number.POSITIVE_INFINITY,
        };

      bucket.totalNow += valueNow;
      bucket.total24hAgo += value24hAgo;

      // Накапливаем sparkline (в USD). Для USD/FIAT линия ровная — добавляем
      // константу `valueNow` на каждой точке (если уже есть длина серии).
      const prices: number[] | null = resolved.sparkUsd;

      if (prices && prices.length > 0) {
        // первое расширение массива до длины серии
        if (bucket.sparkline.length < prices.length) {
          while (bucket.sparkline.length < prices.length) {
            bucket.sparkline.push(0);
          }
        }
        const usableLen = Math.min(bucket.sparkline.length, prices.length);
        for (let i = 0; i < usableLen; i++) {
          bucket.sparkline[i] += prices[i] * quantity;
        }
        // Если этот актив короче — обрезаем итог до его длины (не было
        // данных). Для согласованности всех точек портфеля.
        if (prices.length < bucket.sparklineLen) {
          bucket.sparklineLen = prices.length;
        }
      }

      byPortfolio.set(portfolioId, bucket);
    }

    // *Usd — стоимость в долларах (для recommendations/risk, единый базис).
    // values/change24hAbs/currencies — то же, но в валюте отображения портфеля.
    const valuesUsd: number[] = [];
    const change24hAbsUsd: number[] = [];
    const change24hPct: number[] = [];
    const sparklines7d: number[][] = [];
    const values: number[] = [];
    const change24hAbs: number[] = [];
    const currencies: string[] = [];

    for (const portfolio of portfolios) {
      const stats =
        byPortfolio.get(portfolio.id) ?? {
          totalNow: 0,
          total24hAgo: 0,
          sparkline: [],
          sparklineLen: 0,
        };

      const totalNow = stats.totalNow;
      const total24hAgo = stats.total24hAgo;

      const abs = totalNow - total24hAgo;
      const pct = total24hAgo > 0 ? (abs / total24hAgo) * 100 : 0;

      valuesUsd.push(totalNow);
      change24hAbsUsd.push(abs);
      change24hPct.push(pct);

      // конвертация в валюту отображения
      const currency = normalizeCurrency(portfolio.displayCurrency);
      const factor = currency === "RUB" ? rubPerUsd : 1;
      values.push(totalNow * factor);
      change24hAbs.push(abs * factor);
      currencies.push(currency);

      const len = Number.isFinite(stats.sparklineLen)
        ? Math.min(stats.sparkline.length, stats.sparklineLen)
        : stats.sparkline.length;
      // спарклайн масштабируем в валюту отображения (форма не меняется)
      sparklines7d.push(stats.sparkline.slice(0, len).map((v) => v * factor));
    }

    return {
      portfolios,
      valuesUsd,
      change24hAbsUsd,
      change24hPct,
      sparklines7d,
      values,
      change24hAbs,
      currencies,
    };
  }

  async getPortfolioDetailById(id: number, userId: number) {
    // Один запрос вместо двух: подтягиваем portfolio + его positions через
    // include. Раньше было findByPk → findAll(portfolio_assets) sequential.
    const portfolio = await this.portfolioRepository.findByPk(id, {
      include: [{ model: PortfolioAssets, required: false }],
    });

    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio ${id} not found`,
      );
    }

    if (portfolio.userId !== userId) {
      rpcError(
        HttpStatus.FORBIDDEN,
        "PORTFOLIO_FORBIDDEN",
        `Portfolio ${id} doesn't belong to user ${userId}`,
      );
    }

    // include вернул rows внутри portfolio.<association-key>; имя association по
    // умолчанию = camelCase plural имени модели → "portfolioAssets". Безопасно
    // достаём через any, чтобы не зависеть от @HasMany decorator на Portfolio.
    const rows: PortfolioAssets[] =
      ((portfolio as any).portfolioAssets as PortfolioAssets[]) ?? [];

    const assetIds = Array.from(
      new Set(rows.map((r) => r.assetId).filter((x): x is number => !!x)),
    );

    const [assetsMap, stockMap, rubPerUsd] = await Promise.all([
      this.getAssetsMapByIds(assetIds),
      this.getStockPriceMap(assetIds),
      this.fx.getRubPerUsd(),
    ]);

    const currency = normalizeCurrency(portfolio.displayCurrency);
    // Множитель USD → валюта отображения.
    const displayFactor = currency === "RUB" ? rubPerUsd : 1;

    // Всё считаем В ДОЛЛАРАХ (единый базис), на выходе домножаем на displayFactor.
    let totalNow = 0;
    let total24hAgo = 0;
    let totalInvested = 0;

    const assets = rows
      .map((row) => {
        const asset = assetsMap.get(row.assetId);
        if (!asset) return null;

        // Защита: портфель показывает ТОЛЬКО активы своего типа (крипта в
        // крипто-портфеле, акции в Stock-портфеле). Легаси-позиции чужого
        // типа (добавленные до type-guard'а) сюда не попадут. FIAT (USD-кэш
        // от продаж) допускаем в любом портфеле.
        if (
          String(asset.type) !== String(portfolio.type) &&
          asset.type !== AssetType.FIAT
        ) {
          return null;
        }

        const stock = stockMap.get(row.assetId);
        const resolved = this.resolveUsd(asset, stock, rubPerUsd);
        if (!resolved) return null;

        const quantity = row.quantity ?? 0;
        // averageBuyPrice хранится в НАТИВНОЙ валюте актива (акции — рубли,
        // крипта/USD — доллары). Для USD-базиса переводим рублёвую покупку.
        const nativeFactor = stock ? rubPerUsd : 1;
        const avgBuyNative = row.averageBuyPrice ?? 0;
        const avgBuyUsd = nativeFactor > 0 ? avgBuyNative / nativeFactor : 0;

        const priceUsd = resolved.priceUsd;
        const change24 = resolved.change24;

        const valueNow = quantity * priceUsd;
        const invested = quantity * avgBuyUsd;

        let value24hAgo: number;
        if (!change24) {
          value24hAgo = valueNow;
        } else {
          const denom = 1 + change24 / 100;
          value24hAgo = denom <= 0 ? 0 : quantity * (priceUsd / denom);
        }

        totalNow += valueNow;
        total24hAgo += value24hAgo;
        totalInvested += invested;

        const profit = valueNow - invested;
        const change24hAbsUsd = valueNow - value24hAgo;

        const logoUrlLocal =
          (asset as any).assetData?.logoUrlLocal ?? stock?.logoUrl ?? null;

        return {
          assetId: asset.id,
          ticker: asset.ticker,
          name: (asset as any).name ?? asset.ticker,
          type: asset.type,
          quantity,
          // USD-поля (legacy/recommendations)
          averageBuyPrice: avgBuyUsd,
          currentPriceUsd: priceUsd,
          change24HUsdPct: change24,
          valueUsd: valueNow,
          investedUsd: invested,
          profitUsd: profit,
          profitPct: invested > 0 ? (profit / invested) * 100 : 0,
          change24hAbsUsd,
          // поля в валюте отображения портфеля
          currency,
          currentPrice: priceUsd * displayFactor,
          averageBuyPriceDisplay: avgBuyUsd * displayFactor,
          value: valueNow * displayFactor,
          invested: invested * displayFactor,
          profit: profit * displayFactor,
          change24hAbs: change24hAbsUsd * displayFactor,
          logoUrlLocal,
          categoryIds: getAssetCategoryIds(
            (asset as any).assetData?.categories ?? null,
          ),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const change24hAbs = totalNow - total24hAgo;
    const change24hPct = total24hAgo > 0 ? (change24hAbs / total24hAgo) * 100 : 0;
    const totalProfit = totalNow - totalInvested;
    const totalProfitPct = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    return {
      id: portfolio.id,
      name: portfolio.name,
      type: portfolio.type,
      userId: portfolio.userId,
      // USD-базис
      totalValueUsd: totalNow,
      totalInvestedUsd: totalInvested,
      change24hAbsUsd: change24hAbs,
      change24hPct,
      totalProfitUsd: totalProfit,
      totalProfitPct,
      // валюта отображения + конвертированные тоталы
      currency,
      rubPerUsd,
      totalValue: totalNow * displayFactor,
      totalInvested: totalInvested * displayFactor,
      change24hAbs: change24hAbs * displayFactor,
      totalProfit: totalProfit * displayFactor,
      assets,
    };
  }

  async getPortfolioByName(name: string, userId: number) {
    // userId — обязателен. Раньше сюда искалось по имени глобально, что
    // позволяло любому залогиненному пользователю прочитать чужой портфель
    // с активами и транзакциями (IDOR).
    const portfolio = await this.portfolioRepository.findOne({
      where: { name, userId },
    });

    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio with name "${name}" doesn't exist`,
      );
    }

    return portfolio;
  }

  async getUserSummary(userId: number): Promise<UserPortfoliosSummaryDto> {
    const rows = await this.portfolioAssetsRepository.findAll({
      include: [
        {
          model: Portfolio,
          where: { userId },
          attributes: ["id"],
        },
      ],
    });

    const assetIds = Array.from(
      new Set(rows.map((row) => row.assetId).filter((id): id is number => !!id)),
    );
    const [assetsMap, stockMap, rubPerUsd] = await Promise.all([
      this.getAssetsMapByIds(assetIds),
      this.getStockPriceMap(assetIds),
      this.fx.getRubPerUsd(),
    ]);

    // Глобальный итог по всем портфелям — единый базис USD (акции пересчитаны
    // из рублей). Это число показывается в шапке сайта.
    let totalNow = 0;
    let total24hAgo = 0;

    for (const row of rows) {
      const quantity = row.quantity;
      if (!quantity || quantity <= 0) continue;

      const asset = assetsMap.get(row.assetId);
      if (!asset) continue;

      const resolved = this.resolveUsd(asset, stockMap.get(row.assetId), rubPerUsd);
      if (!resolved) continue;
      const priceNow = resolved.priceUsd;
      const change24 = resolved.change24;

      const valueNow = quantity * priceNow;

      let value24hAgo: number;

      if (!change24) {
        value24hAgo = valueNow;
      } else {
        const denom = 1 + change24 / 100;

        if (denom <= 0) {
          value24hAgo = 0;
        } else {
          const price24hAgo = priceNow / denom;
          value24hAgo = quantity * price24hAgo;
        }
      }

      totalNow += valueNow;
      total24hAgo += value24hAgo;
    }

    if (total24hAgo === 0) {
      return {
        totalValueUsd: totalNow,
        change24hAbsUsd: 0,
        change24hPct: 0,
      };
    }

    const changeAbs = totalNow - total24hAgo;
    const changePct = (changeAbs / total24hAgo) * 100;

    return {
      totalValueUsd: totalNow,
      change24hAbsUsd: changeAbs,
      change24hPct: changePct,
    };
  }

  async deletePortfolio(id: number, userId: number) {
    const portfolio = await this.portfolioRepository.findByPk(id, {
      attributes: ["id", "userId"],
    });

    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio ${id} not found`,
      );
    }

    // Ownership-check — раньше любой залогиненный мог удалить ЛЮБОЙ
    // портфель с его транзакциями и активами (катастрофический IDOR).
    if (portfolio.userId !== userId) {
      rpcError(
        HttpStatus.FORBIDDEN,
        "PORTFOLIO_FORBIDDEN",
        `Portfolio ${id} doesn't belong to user ${userId}`,
      );
    }

    // Атомарное удаление: транзакции и portfolio_assets независимы — удаляем
    // их параллельно внутри одной DB-транзакции, потом сам портфель.
    // Если что-то упадёт — DB откатит всё, не получим частичного состояния.
    await this.sequelize.transaction(async (t) => {
      await Promise.all([
        this.transactionRepository.destroy({
          where: { portfolioId: id },
          transaction: t,
        }),
        this.portfolioAssetsRepository.destroy({
          where: { portfolioId: id },
          transaction: t,
        }),
      ]);
      await this.portfolioRepository.destroy({
        where: { id },
        transaction: t,
      });
    });

    return { message: `Portfolio ${id} was successfully deleted` };
  }
}
