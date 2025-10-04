import { Locator } from 'playwright';
import { BrowserLocatorFilterOptions, BrowserLocatorPort } from '@ports/browser-locator.port';

export class PlaywrightLocatorAdapter implements BrowserLocatorPort {

  constructor(
    private readonly locator: Locator,
  ) { }

  public filter(options: BrowserLocatorFilterOptions): BrowserLocatorPort {
    return new PlaywrightLocatorAdapter(this.locator.filter(options));
  }

  public async isVisible(): Promise<boolean> {
    return await this.locator.isVisible();
  }

}
