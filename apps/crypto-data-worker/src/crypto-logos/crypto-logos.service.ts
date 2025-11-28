import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { CryptoAssetData } from '@libs/crypto-data/models';
import { LogoStorageService } from './logo-storage.service';

@Injectable()
export class CryptoLogosService {
  private readonly log = new Logger(CryptoLogosService.name);

  constructor(
    @InjectModel(CryptoAssetData)
    private readonly cryptoAssetModel: typeof CryptoAssetData,
    private readonly logoStorage: LogoStorageService,
  ) {}

  // Обеспечить локальный логотип для конкретного актива
  async ensureLocalLogo(assetData: CryptoAssetData): Promise<CryptoAssetData> {
    if (assetData.logoUrlLocal) {
      return assetData;
    }

    if (!assetData.logoUrl) {
      this.log.debug(`Asset ${assetData.id} has no external logoUrl, skip`);
      return assetData;
    }

    const url = assetData.logoUrl;

    try {
      this.log.log(
        `Downloading logo for assetId=${assetData.assetId} from ${url}`,
      );

      // --- таймаут через AbortController ---
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      let response: Response;

      try {
        response = await fetch(url, {
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        this.log.warn(
          `Failed to download logo for assetId=${assetData.assetId}: HTTP ${response.status}`,
        );
        return assetData;
      }

      const contentType = response.headers.get('content-type') ?? undefined;
      const extension = this.detectExtension(contentType);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const publicUrl = await this.logoStorage.saveCryptoAssetLogo(
        assetData.assetId,
        buffer,
        extension,
      );

      assetData.logoUrlLocal = publicUrl;
      await assetData.save();

      this.log.log(
        `Saved local logo for assetId=${assetData.assetId} -> ${publicUrl}`,
      );

      return assetData;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.log.warn(
          `Timeout downloading logo for assetId=${assetData.assetId} from ${url}`,
        );
      } else {
        this.log.warn(
          `Failed to download logo for assetId=${assetData.assetId} from ${url}: ${error}`,
        );
      }

      return assetData;
    }
  }

  // пакетная обработка N активов без локального логотипа
  async backfillMissingLogos(batchSize = 100): Promise<void> {
    const assets = await this.cryptoAssetModel.findAll({
      where: {
        logoUrlLocal: null,
        logoUrl: { [Op.ne]: null },
      },
      limit: batchSize,
      order: [['id', 'ASC']],
    });

    if (!assets.length) {
      this.log.debug('No assets without local logos, nothing to do');
      return;
    }

    this.log.log(`Processing ${assets.length} assets to backfill logos`);

    for (const asset of assets) {
      await this.ensureLocalLogo(asset);
    }
  }

  private detectExtension(contentType?: string): string {
    if (!contentType) return 'png';

    const lower = contentType.toLowerCase();

    if (lower.includes('svg')) return 'svg';
    if (lower.includes('jpeg')) return 'jpg';
    if (lower.includes('jpg')) return 'jpg';
    if (lower.includes('webp')) return 'webp';
    if (lower.includes('png')) return 'png';

    return 'png';
  }
}
