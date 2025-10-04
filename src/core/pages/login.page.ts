import { FeedPage } from './feed.page';
import { randms } from '@utils/randms.util';
import { LoggerPort } from '@ports/logger.port';
import 'dotenv/config';
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

  public isAuthenticated(): boolean {
    if (this.page.url().startsWith(FeedPage.url)) {
      this.logger.success('Session detected.');
      return true;
    }

    return false;
  }

}
