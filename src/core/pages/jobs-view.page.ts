import { type Page } from 'playwright';


export class JobsViewPage {

  static readonly url: string = 'https://www.linkedin.com/jobs/view';

  constructor(private page: Page) { }

}


// TODO (dpardo): test this class
