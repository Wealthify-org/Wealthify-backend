import { Inject, Injectable } from "@nestjs/common";
import { WORKER_CLIENT } from "./constant";
import { ClientProxy } from "@nestjs/microservices";
import { sendOrThrow } from "@libs/contracts/common/rpc/client";
import { CRYPTO_DATA_WORKER_PATTERNS } from "@libs/contracts/crypto-data-worker/crypto-data-worker.pattern";
import { SearchAssetsHttpResponse } from "@libs/contracts/crypto-data-worker";

@Injectable()
export class CryptoDataWorkerService {
  constructor(@Inject(WORKER_CLIENT) private readonly workerMs: ClientProxy) {}

  health() {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERNS.HEALTH, {});
  }

  getAssetDataByTicker(ticker: string) {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERNS.GET_ASSET_BY_TICKER, { ticker });
  }

  getAssetChartsByTicker(ticker: string) {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERNS.GET_CHARTS_BY_TICKER, { ticker });
  }

  getDescriptionRu(ticker: string) {
    // Длинные описания + free-модель `gpt-oss-120b:free` (имеет жёсткий
    // rate-limit) → нужен большой timeout: до 6 чанков × до 60с/каждый
    // + паузы 3с между ними + retry 3 попытки на чанк. Реалистичный
    // worst-case ~5 минут. После первого успеха — мгновенно из БД.
    return sendOrThrow(
      this.workerMs,
      CRYPTO_DATA_WORKER_PATTERNS.GET_DESCRIPTION_RU,
      { ticker },
      300_000,
    );
  }

  listAssets(limit?: number, offset?: number, category?: string) {
    return sendOrThrow(this.workerMs, CRYPTO_DATA_WORKER_PATTERNS.LIST_ASSETS, {
      limit,
      offset,
      category,
    });
  }

  searchAssets(query: string, limit?: number) {
    const safeLimit = typeof limit === "number" && Number.isFinite(limit) ? limit : undefined;

    return sendOrThrow(
      this.workerMs,
      CRYPTO_DATA_WORKER_PATTERNS.SEARCH_ASSETS,
      {
        query,
        limit: safeLimit
      }
    )
  }

  getRecentSearches(userId: number, limit?: number) {
    const safeLimit =
      typeof limit === "number" && Number.isFinite(limit) ? limit : undefined;

    return sendOrThrow<SearchAssetsHttpResponse>(
      this.workerMs,
      CRYPTO_DATA_WORKER_PATTERNS.LIST_RECENT_SEARCHES,
      {
        userId,
        limit: safeLimit,
      },
    );
  }

  addRecentSearch(userId: number, assetId: number) {
    return sendOrThrow<void>(
      this.workerMs,
      CRYPTO_DATA_WORKER_PATTERNS.ADD_RECENT_SEARCH,
      {
        userId,
        assetId,
      },
    );
  }

  removeRecentSearch(userId: number, recentId: number) {
    return sendOrThrow<void>(
      this.workerMs,
      CRYPTO_DATA_WORKER_PATTERNS.REMOVE_RECENT_SEARCH,
      {
        userId,
        recentId,
      },
    );
  }

  clearRecentSearches(userId: number) {
    return sendOrThrow<void>(
      this.workerMs,
      CRYPTO_DATA_WORKER_PATTERNS.CLEAR_RECENT_SEARCHES,
      {
        userId,
      },
    );
  }
}