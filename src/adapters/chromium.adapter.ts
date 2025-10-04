import { Browser, BrowserContext, chromium, Page, Cookie } from 'playwright';
import { LoggerPort } from '@ports/logger.port';
import { BrowserPort } from '@ports/browser.port';
import { BrowserPagePort } from '@ports/browser-page.port';
import { PlaywrightPageAdapter } from './playwright/playwright-page.adapter';

import 'dotenv/config';

export class ChromiumAdapter implements BrowserPort {

  private readonly args = [
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--mute-audio',
    '--disable-notifications',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--lang=en-US',
    '--no-default-browser-check',
    '--no-first-run',
    '--disable-popup-blocking',
    '--disable-extensions',
    '--proxy-bypass-list=*',
    '--disable-session-crashed-bubble',
    '--ignore-certificate-errors',
  ];

  public browser!: Browser;

  public browserContext!: BrowserContext;

  constructor(
    private readonly logger: LoggerPort,
  ) { }

  public async launch(config: { headless: boolean }): Promise<void> {
    this.logger.info('Launching browser...');
    this.browser = await this.launchBrowser(config.headless);

    this.logger.info('Launching browser context...');
    const context = await this.newBrowserContext(this.browser);

    this.logger.info('Adding LinkedIn Cookie...');
    const cookie = this.buildLinkedInCookie();
    await this.addCookie(context, cookie);

    this.logger.success('Browser ready to use!');
    this.browserContext = context;
  }

  private async launchBrowser(headless = true): Promise<Browser> {
    return await chromium.launch({ headless, args: this.args });
  }

  private async newBrowserContext(browser: Browser): Promise<BrowserContext> {
    return await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 600 },
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
    });
  }

  private buildLinkedInCookie(): Cookie {
    return {
      name: 'li_at',
      value: process.env.LINKEDIN_COOKIE ?? '',
      domain: '.linkedin.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    };
  }

  private async addCookie(context: BrowserContext, cookie: Cookie): Promise<void> {
    await context.addCookies([cookie]);
  }

  public async close(): Promise<void> {
    this.logger.warn('Closing browser...');
    await this.browserContext.close();
    await this.browser.close();
  }

  public isClosed(): boolean {
    return !this.browser.isConnected() || this.browserContext.pages().length === 0;
  }

  public async firstPage(): Promise<BrowserPagePort> {
    const first = this.browserContext.pages().at(0);
    if (!first) {
      return await this.newPage();
    }
    return this.wrapPage(first);
  }

  public async lastPage(): Promise<BrowserPagePort> {
    const last = this.browserContext.pages().at(-1);
    if (!last) {
      return await this.newPage();
    }
    return this.wrapPage(last);
  }

  public async newPage(): Promise<BrowserPagePort> {
    const page = await this.browserContext.newPage();
    return this.wrapPage(page);
  }

  private wrapPage(page: Page): BrowserPagePort {
    return new PlaywrightPageAdapter(page);
  }

}
