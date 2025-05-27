import { type Page } from 'playwright';


export class JobsViewPage {

  static readonly url: string = 'https://www.linkedin.com/jobs/view';

  constructor(
    private readonly page: Page,
  ) { }

}
