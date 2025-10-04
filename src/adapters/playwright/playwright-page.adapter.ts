import { ElementHandle, Page } from 'playwright';
import {
  BrowserGetByRoleOptions,
  BrowserGetByTextOptions,
  BrowserGotoOptions,
  BrowserPagePort,
  BrowserWaitForSelectorOptions,
} from '@ports/browser-page.port';
import { BrowserElementPort } from '@ports/browser-element.port';
import { PlaywrightElementAdapter } from './playwright-element.adapter';
import { PlaywrightLocatorAdapter } from './playwright-locator.adapter';
import { BrowserLocatorPort } from '@ports/browser-locator.port';

export class PlaywrightPageAdapter implements BrowserPagePort {

  constructor(
    private readonly page: Page,
  ) { }

  public async goto(url: string, options?: BrowserGotoOptions): Promise<void> {
    await this.page.goto(url, options);
  }

  public async waitForTimeout(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }

  public async evaluate<TResult, TArgs extends unknown[]>(pageFunction: (...args: TArgs) => TResult | Promise<TResult>, ...args: TArgs): Promise<TResult> {
    return await this.page.evaluate(pageFunction as any, ...args);
  }

  public async $eval<TResult, TArgs extends unknown[]>(selector: string, pageFunction: (element: HTMLElement, ...args: TArgs) => TResult | Promise<TResult>, ...args: TArgs): Promise<TResult> {
    return await this.page.$eval(selector, pageFunction as any, ...args);
  }

  public async waitForSelector(selector: string, options?: BrowserWaitForSelectorOptions): Promise<BrowserElementPort | null> {
    const element = await this.page.waitForSelector(selector, options as any);
    return this.wrapElement(element);
  }

  public async $(selector: string): Promise<BrowserElementPort | null> {
    const element = await this.page.$(selector);
    return this.wrapElement(element);
  }

  public async $$(selector: string): Promise<BrowserElementPort[]> {
    const elements = await this.page.$$(selector);
    return elements.map(element => new PlaywrightElementAdapter(element));
  }

  public getByRole(role: string, options?: BrowserGetByRoleOptions): BrowserLocatorPort {
    return new PlaywrightLocatorAdapter(this.page.getByRole(role as any, options as any));
  }

  public getByText(text: string, options?: BrowserGetByTextOptions): BrowserLocatorPort {
    return new PlaywrightLocatorAdapter(this.page.getByText(text, options as any));
  }

  public url(): string {
    return this.page.url();
  }

  public once(event: 'close', handler: () => void): void {
    this.page.once(event, handler);
  }

  public async pause(): Promise<void> {
    await this.page.pause();
  }

  private wrapElement(element: ElementHandle | null): BrowserElementPort | null {
    if (!element) return null;
    return new PlaywrightElementAdapter(element);
  }

}
