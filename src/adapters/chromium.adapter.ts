import fs from 'node:fs';
import path from 'node:path';
import { Browser, BrowserContext, BrowserContextOptions, chromium, Page, Cookie } from 'playwright';
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

    if (this.hasStoredSessionState()) {
      this.logger.info('Loaded LinkedIn session state.');
    } else {
      const cookie = this.buildLinkedInCookie();

      if (cookie) {
        this.logger.info('Adding LinkedIn Cookie...');
        await this.addCookie(context, cookie);
      } else {
        this.logger.warn('No LinkedIn session state or cookie found. Manual login will be required.');
      }
    }

    this.logger.success('Browser ready to use!');
    this.browserContext = context;
  }

  private async launchBrowser(headless = true): Promise<Browser> {
    return await chromium.launch({ headless, args: this.args });
  }

  private async newBrowserContext(browser: Browser): Promise<BrowserContext> {
    return await browser.newContext(this.buildBrowserContextOptions());
  }

  private buildBrowserContextOptions(): BrowserContextOptions {
    const options: BrowserContextOptions = {
      viewport: { width: 1280, height: 600 },
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
    };

    if (this.hasStoredSessionState()) {
      options.storageState = this.storageStatePath;
    }

    return options;
  }

  private buildLinkedInCookie(): Cookie | null {
    const value = process.env.LINKEDIN_COOKIE?.trim();

    if (!value) return null;

    return {
      name: 'li_at',
      value,
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

  public async saveSessionState(): Promise<void> {
    this.ensureStorageStateDirectory();
    await this.browserContext.storageState({ path: this.storageStatePath });
    this.logger.success('LinkedIn session state saved.');
  }

  public async clearCookies(): Promise<void> {
    await this.browserContext.clearCookies();
    this.logger.info('Cleared browser cookies.');
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

  private get storageStatePath(): string {
    const configured = process.env.LINKEDIN_STORAGE_STATE_PATH?.trim();
    return configured
      ? path.resolve(process.cwd(), configured)
      : path.resolve(process.cwd(), '.auth/linkedin-storage-state.json');
  }

  private hasStoredSessionState(): boolean {
    return fs.existsSync(this.storageStatePath);
  }

  private ensureStorageStateDirectory(): void {
    fs.mkdirSync(path.dirname(this.storageStatePath), { recursive: true });
  }

}
