import { ElementHandle } from 'playwright';
import { BrowserClickOptions, BrowserElementPort, BrowserElementState } from '@ports/browser-element.port';

export class PlaywrightElementAdapter implements BrowserElementPort {

  constructor(
    private readonly element: ElementHandle,
  ) { }

  public async waitForElementState(state: BrowserElementState): Promise<void> {
    await this.element.waitForElementState(state as any);
  }

  public async scrollIntoViewIfNeeded(): Promise<void> {
    await this.element.scrollIntoViewIfNeeded();
  }

  public async hover(): Promise<void> {
    await this.element.hover();
  }

  public async getAttribute(name: string): Promise<string | null> {
    return await this.element.getAttribute(name);
  }

  public async click(options?: BrowserClickOptions): Promise<void> {
    await this.element.click(options);
  }

  public async evaluate<TResult>(pageFunction: (element: HTMLElement) => TResult | Promise<TResult>): Promise<TResult> {
    return await this.element.evaluate(pageFunction);
  }

}
