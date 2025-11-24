import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";

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
  ) {}

  private async getAssetByTickerOrThrow(
    ticker: string,
  ): Promise<AssetDto> {
    const asset = await lastValueFrom(
      this.assetsClient.send<AssetDto | null>(
        ASSETS_PATTERNS.GET_BY_TICKER,
        { ticker },
      ),
    );

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
      this.assetsClient.send<AssetDto | null>(
        ASSETS_PATTERNS.GET_BY_TICKER,
        { ticker: "USD" },
      ),
    );

    if (!usd) {
      usd = await lastValueFrom(
        this.assetsClient.send<AssetDto>(
          ASSETS_PATTERNS.CREATE,
          {
            name: "US Dollar",
            ticker: "USD",
            type: AssetType.FIAT,
          },
        ),
      );
    }

    return usd;
  }

  async addAssetToPortfolio(dto: AddAssetToPortfolioDto) {
    const { portfolioId, assetTicker, quantity, purchasePrice } = dto;

    const asset = await this.getAssetByTickerOrThrow(assetTicker);

    const portfolio = await this.portfolioRepository.findByPk(portfolioId);
    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio ${portfolioId} not found`,
      );
    }

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

    let portfolioAsset = await this.portfolioAssetRepository.findOne({
      where: { portfolioId, assetId: asset.id },
    });

    const now = new Date();

    if (portfolioAsset) {
      const newQuantity =
        portfolioAsset.quantity + quantity;
      const newAverageBuyPrice =
        (portfolioAsset.quantity * portfolioAsset.averageBuyPrice +
          quantity * purchasePrice) /
        newQuantity;

      portfolioAsset.quantity = newQuantity;
      portfolioAsset.averageBuyPrice = newAverageBuyPrice;
      portfolioAsset.purchaseDate = now;
      await portfolioAsset.save();
    } else {
      portfolioAsset = await this.portfolioAssetRepository.create({
        portfolioId,
        assetId: asset.id,
        quantity,
        averageBuyPrice: purchasePrice,
      });

      portfolioAsset.purchaseDate = now;
      await portfolioAsset.save();
    }

    await this.transactionsService.createTransaction({
      portfolioId,
      assetId: asset.id,
      quantity,
      pricePerUnit: purchasePrice,
      type: TransactionType.BUY,
      date: now,
    });

    return portfolioAsset;
  }

  async sellAsset(dto: SellAssetDto) {
    const {
      portfolioId,
      assetTicker,
      quantity,
      convertToUsd,
      pricePerUnit,
    } = dto;

    const asset = await this.getAssetByTickerOrThrow(assetTicker);

    const portfolio = await this.portfolioRepository.findByPk(portfolioId);
    if (!portfolio) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "PORTFOLIO_NOT_FOUND",
        `Portfolio ${portfolioId} not found`,
      );
    }

    let portfolioAsset = await this.portfolioAssetRepository.findOne({
      where: { portfolioId, assetId: asset.id },
    });

    if (!portfolioAsset) {
      rpcError(
        HttpStatus.NOT_FOUND,
        "ASSET_NOT_IN_PORTFOLIO",
        `No such asset ${assetTicker} in portfolio ${portfolioId}`,
      );
    }

    if (quantity <= 0) {
      rpcError(
        HttpStatus.BAD_REQUEST,
        "INVALID_QUANTITY",
        "Asset quantity should be greater than 0",
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
      await portfolioAsset.destroy();
    } else {
      portfolioAsset.quantity -= quantity;
      await portfolioAsset.save();
    }

    if (convertToUsd) {
      if (!pricePerUnit || pricePerUnit <= 0) {
        rpcError(
          HttpStatus.BAD_REQUEST,
          "INVALID_PRICE",
          "Asset price should be greater than zero",
        );
      }

      const usdAmount = quantity * pricePerUnit;

      const usdAsset = await this.ensureUsdAsset();

      await this.addAssetToPortfolio({
        portfolioId,
        assetTicker: usdAsset.ticker,
        quantity: usdAmount,
        purchasePrice: 1,
      });
    }

    await this.transactionsService.createTransaction({
      portfolioId,
      assetId: asset.id,
      quantity,
      pricePerUnit: pricePerUnit ?? 0,
      type: TransactionType.SELL,
      date: new Date(),
    });

    return portfolioAsset;
  }

  async removeAssetFromPortfolio(
    dto: RemoveAssetFromPortfolioDto,
  ) {
    const { portfolioId, assetTicker, removeAllLinkedTransactions } =
      dto;

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
