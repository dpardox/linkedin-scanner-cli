import { Page } from 'playwright';
import { FeedPage } from './feed.page';
import { randms } from '@utils/randms.util';
import { Logger } from '@interfaces/logger.interface';
import 'dotenv/config';


export class LoginPage {

  static readonly url: string = 'https://www.linkedin.com/login';

  constructor(
    private page: Page,
    private logger: Logger,
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

// TODO (dpardo): test this class
