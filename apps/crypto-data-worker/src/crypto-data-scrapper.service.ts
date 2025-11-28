import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerService } from './puppeteer.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Worker } from "worker_threads";
import { join } from "node:path";

import type {
  CryptoData,
} from '@libs/contracts/crypto-data-worker';
import { Page } from 'puppeteer';
import { CryptoDataWorkerService } from './crypto-data-worker.service';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadProxiesFromEnv, ProxyConfig } from './proxies';

type WorkerInput = {
  proxy: ProxyConfig
  links: string[]; // здесь для бенча будет 1 ссылка на воркер
};

const DEBUG_SCREENSHOTS_DIR = path.resolve(process.cwd(), 'debug-screenshots');

function splitIntoChunks<T>(items: T[], chunksCount: number): T[][] {
  const result: T[][] = [];
  const chunkSize = Math.ceil(items.length / chunksCount);

  for (let i = 0; i < chunksCount; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    result.push(items.slice(start, end));
  }

  return result;
}

@Injectable()
export class CryptoDataScrapperService {
  private readonly log = new Logger('CryptoDataWorker');
  private readonly baseUrl = 'https://www.coingecko.com/en/all-cryptocurrencies';
  private readonly proxies: ProxyConfig[];

  private isRunning = false;

  constructor(
    private readonly pp: PuppeteerService,
    private readonly cryproDataWorkerService: CryptoDataWorkerService,
  ) {
    this.proxies = loadProxiesFromEnv();
  }

  @Cron(CronExpression.EVERY_10_SECONDS) // каждые 5 минут
  async collectAllAssetsDataCron() {
    if (this.isRunning) {
      this.log.warn('Previous collectAllAssets run is still in progress, skipping this tick');
      return;
    }

    this.isRunning = true;
    try {
      await this.collectAllAssets();
    } catch (e) {
      this.log.error(`Cron collect failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async collectAllAssets() {
    this.log.log('Collecting TOP-200 from CoinGecko...');
    const page = await this.pp.newPage(this.proxies[0]);

    try {
      await this.openAllCryptosPage(page, this.baseUrl);
      this.log.log('Ждем всех ссылок');

      const { totalCount } = await this.readAllCoinsMeta(page);

      // собираем ссылки и догружаем до 200
      let links = await this.collectLinks(page);
      links = await this.loadMoreUntil(page, {
        startPage: 2,
        hardLimit: 2000,
        maxLinks: 200, 
        totalCount,
      });

      this.log.log(`Collected ${links.length} links (need first 200).`);

      const top = links.slice(0, 10);

      // СРАВНЕНИЕ СКОРОСТИ
      // await this.runBenchmarkWithWorkers(top);

      this.log.log(`Start parsing ${top.length} assets with parallel Puppeteer browsers...`);

      const chunks = splitIntoChunks(top, this.proxies.length);

      await this.workersRun(this.proxies, chunks);
    } finally {
      try {
        if (!page.isClosed()) {
          await page.close();
        }
      } catch {}
    }
  }

  private async workersRun(proxies: ProxyConfig[], linksChunks: string[][]): Promise<void> {
    const workerScript = join(
      process.cwd(),
      "dist",
      "worker-scripts",
      "crypto-data-worker",
      "apps",
      "crypto-data-worker",
      "src",
      "workers",
      "crypto-parser.worker.js",
    );

    if (!proxies.length || !linksChunks.length) {
      this.log.warn('No proxies or links — skipping workers run');
      return;
    }

    const tasks: Promise<void>[] = [];

    for(let i = 0; i < Math.min(proxies.length, linksChunks.length); i++) {
      const proxy = proxies[i];
      const links = linksChunks[i];
      if (!links || !links.length) continue;

      tasks.push(
        new Promise<void>((resolve) => {
          let terminatedByUs = false;

          const worker = new Worker(workerScript);
          const data: WorkerInput = { proxy, links };

          worker.once("message", async (cryptoDatas: CryptoData[]) => {
            try {
              for (const cryptoData of cryptoDatas) {
                await this.cryproDataWorkerService.upsertFromCryptoData(cryptoData);
              }
            } catch (e) {
              this.log.error(
                `Failed to upsert data from worker: ${
                  e instanceof Error ? e.message : e
                }`,
              );
            } finally {
              terminatedByUs = true;
              await worker.terminate().catch(() => {});
              resolve();
            }
          });

          worker.once("error", async (err) => {
            this.log.error(`ERROR ON WORKER - ${err}`);
            terminatedByUs = true;
            await worker.terminate().catch(() => {});
            resolve();
          });

          worker.once("exit", (code) => {
            if (!terminatedByUs && code !== 0) {
              this.log.error(`RETURNED WITH NON ZERO CODE - ${code}`);
            } else {
              this.log.debug?.(`Worker exited with code ${code}`);
            }
            resolve();
          });

          worker.postMessage(data);
        }),
      );
    }
    
    await Promise.all(tasks);
  }

  private async openAllCryptosPage(page: Page, baseUrl: string): Promise<void> {
    await page.goto(baseUrl);
    await page.waitForSelector('tbody tr a[href^="/en/coins/"]', { timeout: 20_000 });
  }

  private async readAllCoinsMeta(page: Page): Promise<{ totalCount: number; pageSize: number }> {
    return page.evaluate(() => {
      const el = document.querySelector(
        'div[data-controller~="all-coins-index"][data-page-size]'
      ) as HTMLDivElement | null;
      return {
        totalCount: Number(el?.getAttribute('data-content-count') || '0'),
        pageSize: Number(el?.getAttribute('data-page-size') || '50'),
      };
    });
  }

  private async collectLinks(page: Page): Promise<string[]> {
    return page.$$eval('tbody tr a[href^="/en/coins/"]', (anchors: HTMLAnchorElement[]) => {
      return anchors
        .map((a) => a.href.replace(/[#?].*$/, ''))
        .filter(Boolean)
        .filter((href, i, arr) => arr.indexOf(href) === i);
    });
  }

  private async loadMoreUntil(
    page: Page,
    {
      startPage = 2,
      hardLimit = 2000,
      maxLinks = 100,
      totalCount = 0,
    }: { startPage?: number; hardLimit?: number; maxLinks?: number; totalCount?: number }
  ): Promise<string[]> {
    let pageNum = startPage;
    let stagnant = 0;

    let links = await this.collectLinks(page);

    for (let i = 0; i < hardLimit; i++) {
      if (totalCount > 0 && links.length >= totalCount) break;

      const added = await page
        .evaluate((p: number) => {
          const url = `/en/all-cryptocurrencies/show_more_coins?page=${p}`;
          return fetch(url, {
            headers: { Accept: 'text/html, */*;q=0.1', 'X-Requested-With': 'XMLHttpRequest' },
            method: 'GET',
            credentials: 'same-origin',
          })
            .then((res) => (res.ok ? res.text() : ''))
            .then((html) => {
              if (!html || !html.trim()) return 0;
              const tbody = document.querySelector('tbody');
              if (!tbody) return 0;

              const tmp = document.createElement('tbody');
              tmp.innerHTML = html;

              const rows = Array.from(tmp.querySelectorAll('tr'));
              for (const r of rows) tbody.appendChild(r);
              return rows.length;
            })
            .catch((): number => 0);
        }, pageNum)
        .catch((): number => 0);

      if (!added || added === 0) {
        stagnant++;
        if (stagnant >= 2) break;
      } else {
        stagnant = 0;
        pageNum++;
      }

      await this.sleep(150);
      links = await this.collectLinks(page);
      if (links.length > maxLinks) break;
    }

    return links;
  }

  // утилиты
  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async safeDebugScreenshot(
    page: Page,
    href: string,
    context: string,
  ): Promise<void> {
    try {
      if (page.isClosed()) {
        this.log.warn(
          `Cannot take screenshot for ${href}: page is already closed`,
        );
        return;
      }

      await fs.promises.mkdir(DEBUG_SCREENSHOTS_DIR, { recursive: true });

      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const safeHref = href.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
      const filename = `${context}_${safeHref}_${ts}.png`;

      const fullPath = path.join(DEBUG_SCREENSHOTS_DIR, filename);

      await page.screenshot({
        path: fullPath as `${string}.png`,
        fullPage: true,
      });

      this.log.warn(`Saved debug screenshot for ${href} to ${fullPath}`);
    } catch (e) {
      this.log.error(
        `Failed to save screenshot for ${href}: ${
          e instanceof Error ? e.message : e
        }`,
      );
    }
  }
}
