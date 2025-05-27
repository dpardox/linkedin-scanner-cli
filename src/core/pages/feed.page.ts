import { type Page } from 'playwright';


export class FeedPage {

  static readonly url: string = 'https://www.linkedin.com/feed';

  constructor(
    private readonly page: Page,
  ) { }

}
