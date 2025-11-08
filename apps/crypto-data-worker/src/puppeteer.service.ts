import { Injectable, OnModuleDestroy } from '@nestjs/common';
const puppeteer = require('puppeteer-extra'); // оставил CJS, как у тебя
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
import type { Browser, Page } from 'puppeteer';

puppeteer.use(StealthPlugin());

@Injectable()
export class PuppeteerService implements OnModuleDestroy {
  private browser: Browser | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser;
    }
    const created = await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1920, height: 1080 },
    });

    this.browser = created;
    return created;
  }

  async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    return page;
  }
  
  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}