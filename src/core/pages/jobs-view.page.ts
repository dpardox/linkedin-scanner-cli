import { BrowserPagePort } from '@ports/browser-page.port';


export class JobsViewPage {

  static readonly url: string = 'https://www.linkedin.com/jobs/view';

  constructor(
    private readonly page: BrowserPagePort,
  ) { }

}
