import { type Page, BrowserContext } from 'playwright';


export class FeedPage {

  static readonly url: string = 'https://www.linkedin.com/feed';

  constructor(private page: Page) { }

}

// TODO (dpardo): test this class
