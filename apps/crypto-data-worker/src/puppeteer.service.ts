import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteerExtra from 'puppeteer-extra';
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import type { Browser, Page } from 'puppeteer';
import { ProxyConfig } from './proxies';

puppeteerExtra.use(StealthPlugin());

export { puppeteerExtra };

@Injectable()
export class PuppeteerService implements OnModuleDestroy {
  private browsers = new Map<string, Browser>();

  private getKey(proxy?: ProxyConfig): string {
    return proxy ? `${proxy.host}:${proxy.port}` : 'direct';
  }

  async getBrowser(proxy?: ProxyConfig): Promise<Browser> {
    const key = proxy ? `${proxy.host}:${proxy.port}` : 'direct';

    const cached = this.browsers.get(key);
    if (cached) return cached;

    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ];

    if (proxy) {
      args.push(`--proxy-server=http://${proxy.host}:${proxy.port}`);
    }

    const browser = await puppeteerExtra.launch({
      headless: true,
      defaultViewport: { width: 1920, height: 1080 },
      args,
    });

    this.browsers.set(key, browser);
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
    const browser = this.browsers.get(key);
    if (!browser) return;

    try {
      await browser.close();
    } catch {
      // ignore
    } finally {
      this.browsers.delete(key);
    }
  }

  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.browsers.values()).map((b) =>
        b.close().catch(() => {}),
      ),
    );
    this.browsers.clear();
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(this.browsers.values()).map((b) => b.close().catch(() => {})),
    );
    this.browsers.clear();
  }
}
