import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

@Injectable()
export class LogoStorageService {
  constructor(private readonly configService: ConfigService) {}

  private get baseDir(): string {
    // путь на ФС, где живут логотипы
    return (
      this.configService.get<string>('LOGOS_STORAGE_DIR') ??
      path.resolve(process.cwd(), 'storage', 'logos')
    );
  }

  private get publicPrefix(): string {
    // префикс, по которому фронт будет их видеть
    // например, /static/logos → https://api.yourapp.com/static/logos/...
    return this.configService.get<string>('LOGOS_PUBLIC_PREFIX') ?? '/static/logos';
  }

  async saveCryptoAssetLogo(
    assetId: number,
    buffer: Buffer,
    extension: string,
  ): Promise<string> {
    const dir = path.join(this.baseDir, 'crypto');
    await fs.mkdir(dir, { recursive: true });

    const filename = `${assetId}.${extension}`;
    const fullPath = path.join(dir, filename);

    await fs.writeFile(fullPath, buffer);

    // то, что пойдёт на фронт
    return `${this.publicPrefix}/crypto/${filename}`;
  }

  async logoExists(assetId: number): Promise<boolean> {
    const dir = path.join(this.baseDir, 'crypto');
    const possibleFiles = ['png', 'jpg', 'jpeg', 'webp', 'svg'].map((ext) =>
      path.join(dir, `${assetId}.${ext}`),
    );

    for (const file of possibleFiles) {
      try {
        await fs.access(file);
        return true;
      } catch {
        // ignore
      }
    }

    return false;
  }
}
