import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
} from '@nestjs/common';
import puppeteerExtra from 'puppeteer-extra';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import type { Browser, Page } from 'puppeteer';
import { ProxyConfig } from './proxies';

puppeteerExtra.use(StealthPlugin());

export { puppeteerExtra };

/**
 * Запись о запущенном браузере.
 *
 * Хранит сам Browser-инстанс + PID Chrome-процесса, который puppeteer
 * породил через child_process.spawn. PID нужен для жёсткого fallback'а
 * (`process.kill(pid, 'SIGKILL')`) когда вежливый `browser.close()`
 * подвисает или Chrome успел отщепиться от Node-родителя (Mac/Linux
 * иногда оставляют helper-процессы — Renderer, GPU, Network).
 */
interface BrowserRecord {
  browser: Browser;
  pid: number | undefined;
}

/**
 * Закрытие браузера должно завершиться вне зависимости от состояния
 * сетевых таймаутов puppeteer'а. 3 секунды — практический потолок:
 * нормальный close занимает <500мс, всё что дольше — повисло.
 */
const CLOSE_TIMEOUT_MS = 3_000;

@Injectable()
export class PuppeteerService
  implements OnModuleDestroy, OnApplicationShutdown
{
  private readonly log = new Logger(PuppeteerService.name);
  private browsers = new Map<string, BrowserRecord>();

  /** Перешли ли мы в режим shutdown — после этого новые browser'ы не выдаём. */
  private shuttingDown = false;

  private getKey(proxy?: ProxyConfig): string {
    return proxy ? `${proxy.host}:${proxy.port}` : 'direct';
  }

  async getBrowser(proxy?: ProxyConfig): Promise<Browser> {
    if (this.shuttingDown) {
      throw new Error(
        'PuppeteerService is shutting down — refusing new browser',
      );
    }

    const key = this.getKey(proxy);

    const cached = this.browsers.get(key);
    if (cached) return cached.browser;

    const args = ['--no-sandbox', '--disable-setuid-sandbox'];

    if (proxy) {
      args.push(`--proxy-server=http://${proxy.host}:${proxy.port}`);
    }

    const browser = await puppeteerExtra.launch({
      headless: true,
      defaultViewport: { width: 1920, height: 1080 },
      args,
    });

    // PID родительского Chrome-процесса. Если puppeteer не вернул process()
    // (теоретически возможно, например при connect()), запоминаем undefined —
    // fallback-kill просто пропустится.
    const childProcess = browser.process();
    const pid = childProcess?.pid;

    this.browsers.set(key, { browser, pid });

    // Если Chrome неожиданно умрёт сам (краш) — убираем запись из мапы,
    // чтобы при следующем getBrowser мы запустили новый, а не вернули зомби.
    browser.once('disconnected', () => {
      const current = this.browsers.get(key);
      if (current?.browser === browser) {
        this.browsers.delete(key);
      }
    });

    return browser;
  }

  async newPage(proxy?: ProxyConfig): Promise<Page> {
    const browser = await this.getBrowser(proxy);
    const page = await browser.newPage();

    if (proxy?.username && proxy?.password) {
      await page.authenticate({
        username: proxy.username,
        password: proxy.password,
      });
    }

    return page;
  }

  async closeBrowser(proxy?: ProxyConfig): Promise<void> {
    const key = this.getKey(proxy);
    const record = this.browsers.get(key);
    if (!record) return;
    this.browsers.delete(key);
    await this.closeOne(record);
  }

  async closeAll(): Promise<void> {
    const records = Array.from(this.browsers.values());
    this.browsers.clear();
    await Promise.all(records.map((r) => this.closeOne(r)));
  }

  /**
   * Закрывает один browser-инстанс с timeout-fallback'ом на SIGKILL по PID.
   *
   * Алгоритм:
   *  1. Параллельно запускаем `browser.close()` и таймер 3с.
   *  2. Кто из них сработает первым — тот и победил.
   *  3. Если `close()` завершился — Chrome успешно остановлен (родительский
   *     процесс получил SIGTERM от puppeteer и завершил все helper-ы).
   *  4. Если сработал таймер — добиваем по PID `SIGKILL`'ом.
   */
  private async closeOne(record: BrowserRecord): Promise<void> {
    const { browser, pid } = record;
    let timer: NodeJS.Timeout | null = null;

    try {
      const closePromise = browser.close().catch((e) => {
        this.log.warn(
          `browser.close() rejected: ${(e as Error)?.message ?? e}`,
        );
      });
      const timeoutPromise = new Promise<'TIMEOUT'>((resolve) => {
        timer = setTimeout(() => resolve('TIMEOUT'), CLOSE_TIMEOUT_MS);
      });

      const winner = await Promise.race([
        closePromise.then(() => 'OK' as const),
        timeoutPromise,
      ]);

      if (winner === 'TIMEOUT' && pid != null) {
        this.log.warn(
          `browser.close() timed out after ${CLOSE_TIMEOUT_MS}ms — sending SIGKILL to pid=${pid}`,
        );
        try {
          process.kill(pid, 'SIGKILL');
        } catch (e) {
          // ESRCH — процесс уже завершился сам, это OK
          const err = e as NodeJS.ErrnoException;
          if (err.code !== 'ESRCH') {
            this.log.warn(
              `Failed to SIGKILL pid=${pid}: ${err.message ?? err}`,
            );
          }
        }
      }
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * onApplicationShutdown срабатывает, когда NestFactory вызывает
   * `app.close()` — это происходит при `enableShutdownHooks()` + SIGINT/
   * SIGTERM/SIGHUP, либо когда мы явно дёргаем app.close() из main.ts.
   * Гарантированно бежит до выхода процесса.
   */
  async onApplicationShutdown(signal?: string): Promise<void> {
    this.shuttingDown = true;
    if (this.browsers.size === 0) return;
    this.log.log(
      `onApplicationShutdown(${signal ?? '-'}) — closing ${this.browsers.size} browser(s)`,
    );
    await this.closeAll();
  }

  /**
   * onModuleDestroy — фолбэк для HMR-перезагрузки и явных вызовов app.close()
   * без сигнала. Обе ловушки идемпотентны: `closeAll` дважды пройдёт
   * по пустой Map после первого срабатывания.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.browsers.size === 0) return;
    this.log.log(`onModuleDestroy — closing ${this.browsers.size} browser(s)`);
    await this.closeAll();
  }
}
