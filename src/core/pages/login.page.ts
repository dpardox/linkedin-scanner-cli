import { FeedPage } from './feed.page';
import { randms } from '@utils/randms.util';
import { LoggerPort } from '@ports/logger.port';
import { BrowserPagePort } from '@ports/browser-page.port';

export class LoginPage {

  static readonly url: string = 'https://www.linkedin.com/login';

  constructor(
    private readonly page: BrowserPagePort,
    private readonly logger: LoggerPort,
  ) { }


  public async open(): Promise<void> {
    this.logger.info('Opening login page...');
    await this.page.goto(LoginPage.url, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(randms());
  }

  public async ensureAuthenticated(resetSession?: () => Promise<void>): Promise<void> {
    this.logger.info('Checking LinkedIn session...');

    try {
      await this.page.goto(FeedPage.url, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(randms());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Stored LinkedIn session looks invalid: %s', message);
    }

    if (this.isAuthenticated()) {
      this.logger.success('Session detected.');
      return;
    }

    if (resetSession) {
      await resetSession();
    }

    this.logger.warn('LinkedIn session not detected. Complete the login manually in the browser window...');
    await this.open();
    await this.waitForAuthentication();
    this.logger.success('Session detected.');
  }

  public isAuthenticated(): boolean {
    const url = this.page.url();
    if (!url.startsWith('https://www.linkedin.com/')) return false;
    if (url.startsWith(LoginPage.url)) return false;
    if (url.includes('/checkpoint/')) return false;
    if (url.includes('/uas/login')) return false;
    return true;
  }

  private async waitForAuthentication(timeoutMs = 5 * 60 * 1000): Promise<void> {
    const startedAt = Date.now();

    while (!this.isAuthenticated()) {
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error('Timed out waiting for LinkedIn login.');
      }

      await this.page.waitForTimeout(1000);
    }
  }

}
