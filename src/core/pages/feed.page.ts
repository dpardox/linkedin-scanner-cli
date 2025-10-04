import { BrowserPagePort } from '@ports/browser-page.port';


export class FeedPage {

  static readonly url: string = 'https://www.linkedin.com/feed';

  constructor(
    private readonly page: BrowserPagePort,
  ) { }

}
