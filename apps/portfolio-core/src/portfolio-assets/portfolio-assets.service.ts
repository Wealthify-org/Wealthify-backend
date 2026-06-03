import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { InjectConnection, InjectModel } from "@nestjs/sequelize";
import { ClientProxy } from "@nestjs/microservices";
import { catchError, lastValueFrom, of, throwError, timeout } from "rxjs";
import { Sequelize } from "sequelize-typescript";
import type { Transaction as SeqTx } from "sequelize";

const RPC_TIMEOUT_MS = 5_000;
const rpcLog = new Logger("PortfolioAssetsService.RPC");

import { PortfolioAssets } from "./portfolio-assets.model";
import { Portfolio } from "../portfolios/portfolios.model";
import { TransactionsService } from "../transactions/transactions.service";

import {
  AddAssetToPortfolioDto,
  AssetType,
  RemoveAssetFromPortfolioDto,
  SellAssetDto,
} from "@libs/contracts";
import { TransactionType } from "@libs/contracts/common/enums/transaction-type.enum";
import { rpcError } from "@libs/contracts/common";
import { ASSETS_PATTERNS } from "@libs/contracts/assets/assets.pattern";
import { ASSETS_CLIENT } from "../portfolios/portfolio.constants";

interface AssetDto {
  id: number;
  ticker: string;
  type: AssetType;
}

@Injectable()
export class PortfolioAssetsService {
  constructor(
    @InjectModel(PortfolioAssets)
    private readonly portfolioAssetRepository: typeof PortfolioAssets,
    @InjectModel(Portfolio)
    private readonly portfolioRepository: typeof Portfolio,
    private readonly transactionsService: TransactionsService,
    @Inject(ASSETS_CLIENT)
    private readonly assetsClient: ClientProxy,
    @InjectConnection()
    private readonly sequelize: Sequelize,
  ) {}

  private async getAssetByTickerOrThrow(ticker: string): Promise<AssetDto> {
    // Раньше lastValueFrom без timeout — каждый сбой assets-MS вешал
    // mutation-flow клиента. Теперь — 5с timeout + структурированная RPC-ошибка.
    const asset = await lastValueFrom(
      this.assetsClient
        .send<AssetDto | null>(ASSETS_PATTERNS.GET_BY_TICKER, { ticker })
        .pipe(
          timeout(RPC_TIMEOUT_MS),
          catchError((err) => {
            rpcLog.error(
              `assets-MS GET_BY_TICKER(${ticker}) failed: ${(err as Error)?.message ?? err}`,
            );
            return throwError(() =>
              new Error("ASSETS_SERVICE_UNAVAILABLE"),
            );
          }),
        ),
    ).catch(() => null);

    if (!asset) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "ASSET_NOT_FOUND",
        `Asset ${ticker} not found`,
      );
    }

    return asset;
  }

  private async ensureUsdAsset(): Promise<AssetDto> {
    let usd = await lastValueFrom(
      this.assetsClient
        .send<AssetDto | null>(ASSETS_PATTERNS.GET_BY_TICKER, {
          ticker: "USD",
        })
        .pipe(
          timeout(RPC_TIMEOUT_MS),
          catchError((err) => {
            rpcLog.error(
              `assets-MS GET_BY_TICKER(USD) failed: ${(err as Error)?.message ?? err}`,
            );
            return of<AssetDto | null>(null);
          }),
        ),
    );

    if (!usd) {
      usd = await lastValueFrom(
        this.assetsClient
          .send<AssetDto>(ASSETS_PATTERNS.CREATE, {
            name: "US Dollar",
            ticker: "USD",
            type: AssetType.FIAT,
          })
          .pipe(timeout(RPC_TIMEOUT_MS)),
      );
    }

    if (!usd) {
      rpcError(
        HttpStatus.SERVICE_UNAVAILABLE,
        "USD_ASSET_UNAVAILABLE",
        "Failed to ensure USD asset",
      );
    }

    return usd;
  }

  /**
   * Проверяет, что портфель существует и принадлежит вызывающему пользователю.
   * Раньше операции add/sell/remove не проверяли ownership — любой залогиненный
   * пользователь мог мутировать чужие портфели по id.
   */
  private async assertPortfolioOwnedByUser(
    portfolioId: number,
    userId: number,
  ): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findByPk(portfolioId, {
      attributes: ["id", "userId", "type"],
    });
    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio ${portfolioId} not found`,
      );
    }
    if (portfolio.userId !== userId) {
      rpcError(
        HttpStatus.FORBIDDEN,
        "PORTFOLIO_FORBIDDEN",
        `Portfolio ${portfolioId} doesn't belong to user ${userId}`,
      );
    }
    return portfolio;
  }

  // Тип актива должен совпадать с типом портфеля. PortfolioType и AssetType —
  // разные энамы, но с одинаковыми строковыми значениями ('Crypto'/'Stock'/
  // 'Bond'), поэтому сравниваем по строке. Это закрывает баг, когда акцию
  // (Stock) можно было положить в крипто-портфель.
  private assertAssetTypeMatchesPortfolio(
    assetType: AssetType,
    portfolio: Portfolio,
  ): void {
    if (String(assetType) !== String(portfolio.type)) {
      rpcError(
        HttpStatus.BAD_REQUEST,
        "ASSET_TYPE_MISMATCH",
        `Asset of type ${assetType} cannot be added to a ${portfolio.type} portfolio`,
      );
    }
  }

  async addAssetToPortfolio(dto: AddAssetToPortfolioDto, userId: number) {
    const { portfolioId, assetTicker, quantity, purchasePrice } = dto;

    // ── ВАЛИДАЦИЯ + RPC до tx ───────────────────────────────────────────
    const portfolio = await this.assertPortfolioOwnedByUser(portfolioId, userId);

    if (quantity <= 0) {
      rpcError(
        HttpStatus.BAD_REQUEST,
        "INVALID_QUANTITY",
        "Asset quantity should be greater than 0",
      );
    }

    if (purchasePrice <= 0) {
      rpcError(
        HttpStatus.BAD_REQUEST,
        "INVALID_PRICE",
        "Asset price should be greater than 0",
      );
    }

    const asset = await this.getAssetByTickerOrThrow(assetTicker);

    // акция → только в Stock-портфель, крипта → только в Crypto-портфель
    this.assertAssetTypeMatchesPortfolio(asset.type, portfolio);

    // ── DB-MUTATIONS В TX ───────────────────────────────────────────────
    // Раньше: findOne → conditional create()/save() без транзакции и без
    // row-lock. На двойном POST (быстрый клик / retry) оба запроса видели
    // null → оба create() → второй ловил SequelizeUniqueConstraintError
    // (по unique-индексу portfolioId+assetId), а пользователь получал 500.
    // Теперь: SELECT FOR UPDATE сериализует параллельные buy одного актива
    // → второй увидит уже созданную строку и пойдёт по update-ветке.
    return this.sequelize.transaction(async (t) => {
      const now = new Date();
      let portfolioAsset = await this.portfolioAssetRepository.findOne({
        where: { portfolioId, assetId: asset.id },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (portfolioAsset) {
        const newQuantity = portfolioAsset.quantity + quantity;
        const newAverageBuyPrice =
          (portfolioAsset.quantity * portfolioAsset.averageBuyPrice +
            quantity * purchasePrice) /
          newQuantity;

        portfolioAsset.quantity = newQuantity;
        portfolioAsset.averageBuyPrice = newAverageBuyPrice;
        portfolioAsset.purchaseDate = now;
        await portfolioAsset.save({ transaction: t });
      } else {
        portfolioAsset = await this.portfolioAssetRepository.create(
          {
            portfolioId,
            assetId: asset.id,
            quantity,
            averageBuyPrice: purchasePrice,
            purchaseDate: now,
          } as any,
          { transaction: t },
        );
      }

      await this.transactionsService.createTransaction(
        {
          portfolioId,
          assetId: asset.id,
          quantity,
          pricePerUnit: purchasePrice,
          type: TransactionType.BUY,
          date: now,
        },
        { transaction: t },
      );

      return portfolioAsset;
    });
  }

  async sellAsset(dto: SellAssetDto, userId: number) {
    const {
      portfolioId,
      assetTicker,
      quantity,
      convertToUsd,
      pricePerUnit,
    } = dto;

    // ── ВАЛИДАЦИЯ + RPC до транзакции ────────────────────────────────────
    // RPC к assets-MS DB-state не трогает, делать в транзакции
    // их нельзя (ms-вызов длинный → удержит row-lock). Поэтому до tx.
    await this.assertPortfolioOwnedByUser(portfolioId, userId);

    if (quantity <= 0) {
      rpcError(
        HttpStatus.BAD_REQUEST,
        "INVALID_QUANTITY",
        "Asset quantity should be greater than 0",
      );
    }

    if (convertToUsd && (!pricePerUnit || pricePerUnit <= 0)) {
      rpcError(
        HttpStatus.BAD_REQUEST,
        "INVALID_PRICE",
        "Asset price should be greater than zero",
      );
    }

    const asset = await this.getAssetByTickerOrThrow(assetTicker);
    const usdAsset = convertToUsd ? await this.ensureUsdAsset() : null;

    // ── DB-MUTATIONS В ОДНОЙ ТРАНЗАКЦИИ ─────────────────────────────────
    // Раньше: destroy/save/create были последовательными без tx. Если
    // assets-MS моргал на ensureUsdAsset, или БД падала на createTransaction
    // — пользователь терял asset без USD-кредита и без аудит-записи.
    // Теперь: всё в одной atomic-tx. Любая ошибка → полный rollback,
    // юзер видит ошибку, но в БД ничего не изменилось.
    return this.sequelize.transaction(async (t) => {
      const portfolioAsset = await this.portfolioAssetRepository.findOne({
        where: { portfolioId, assetId: asset.id },
        // FOR UPDATE — блокируем строку до конца tx, чтобы параллельная
        // продажа того же актива не привела к двойному списанию или
        // отрицательному quantity.
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!portfolioAsset) {
        rpcError(
          HttpStatus.NOT_FOUND,
          "ASSET_NOT_IN_PORTFOLIO",
          `No such asset ${assetTicker} in portfolio ${portfolioId}`,
        );
      }

      if (portfolioAsset.quantity < quantity) {
        rpcError(
          HttpStatus.BAD_REQUEST,
          "NOT_ENOUGH_ASSET",
          "Not enough asset to sell",
        );
      }

      if (portfolioAsset.quantity === quantity) {
        await portfolioAsset.destroy({ transaction: t });
      } else {
        portfolioAsset.quantity -= quantity;
        await portfolioAsset.save({ transaction: t });
      }

      // USD-кредит инлайн в той же транзакции. Раньше мы рекурсивно звали
      // addAssetToPortfolio — это делало доп. ownership-check, RPC, и
      // плодило транзакции вне нашей tx. Теперь всё локально.
      if (convertToUsd && usdAsset && pricePerUnit) {
        const usdAmount = quantity * pricePerUnit;

        // Cost-basis carry-over (см. подробное описание ниже исходного кода
        // в истории — формула: usd_avgBuy = avg_buy_of_sold / sellPrice).
        const soldAvgBuy = portfolioAsset.averageBuyPrice;
        const usdPurchasePrice =
          Number.isFinite(soldAvgBuy) && soldAvgBuy > 0
            ? soldAvgBuy / pricePerUnit
            : 1;

        await this.creditUsdInTx(
          t,
          portfolioId,
          usdAsset.id,
          usdAmount,
          usdPurchasePrice,
        );
      }

      await this.transactionsService.createTransaction(
        {
          portfolioId,
          assetId: asset.id,
          quantity,
          pricePerUnit: pricePerUnit ?? 0,
          type: TransactionType.SELL,
          date: new Date(),
        },
        { transaction: t },
      );

      return portfolioAsset;
    });
  }

  /**
   * Атомарный USD-кредит внутри уже открытой sequelize-tx. Делает upsert по
   * (portfolioId, usdAssetId): если позиция уже есть — реусредняет avgBuy,
   * нет — создаёт. Записывает BUY-транзакцию для USD.
   *
   * НЕ ВЫЗЫВАТЬ снаружи sellAsset — нет ownership-check, рассчитан на то,
   * что caller уже проверил права.
   */
  private async creditUsdInTx(
    t: SeqTx,
    portfolioId: number,
    usdAssetId: number,
    usdAmount: number,
    usdPurchasePrice: number,
  ): Promise<void> {
    const now = new Date();
    const existing = await this.portfolioAssetRepository.findOne({
      where: { portfolioId, assetId: usdAssetId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (existing) {
      const newQty = existing.quantity + usdAmount;
      const newAvg =
        (existing.quantity * existing.averageBuyPrice +
          usdAmount * usdPurchasePrice) /
        newQty;
      existing.quantity = newQty;
      existing.averageBuyPrice = newAvg;
      existing.purchaseDate = now;
      await existing.save({ transaction: t });
    } else {
      await this.portfolioAssetRepository.create(
        {
          portfolioId,
          assetId: usdAssetId,
          quantity: usdAmount,
          averageBuyPrice: usdPurchasePrice,
          purchaseDate: now,
        } as any,
        { transaction: t },
      );
    }

    await this.transactionsService.createTransaction(
      {
        portfolioId,
        assetId: usdAssetId,
        quantity: usdAmount,
        pricePerUnit: usdPurchasePrice,
        type: TransactionType.BUY,
        date: now,
      },
      { transaction: t },
    );
  }

  async removeAssetFromPortfolio(
    dto: RemoveAssetFromPortfolioDto,
    userId: number,
  ) {
    const { portfolioId, assetTicker, removeAllLinkedTransactions } = dto;

    await this.assertPortfolioOwnedByUser(portfolioId, userId);

    const asset = await this.getAssetByTickerOrThrow(assetTicker);

    const portfolioAsset =
      await this.portfolioAssetRepository.findOne({
        where: { portfolioId, assetId: asset.id },
      });

    if (!portfolioAsset) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "ASSET_NOT_IN_PORTFOLIO",
        `Asset ${assetTicker} not found in portfolio ${portfolioId}`,
      );
    }

    if (removeAllLinkedTransactions) {
      await this.transactionsService.deleteAllLinkedTransactions({
        portfolioId,
        assetId: asset.id,
      });
    }

    await portfolioAsset.destroy();

    return {
      message: `Asset ${assetTicker} was successfully deleted from portfolio ${portfolioId}`,
    };
  }
}
