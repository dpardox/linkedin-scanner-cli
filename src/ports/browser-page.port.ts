import { BrowserElementPort } from './browser-element.port';
import { BrowserLocatorPort } from './browser-locator.port';

export type BrowserWaitUntil = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export interface BrowserGotoOptions {
  waitUntil?: BrowserWaitUntil;
}

export type BrowserWaitForSelectorState = 'attached' | 'detached' | 'visible' | 'hidden';

export interface BrowserWaitForSelectorOptions {
  state?: BrowserWaitForSelectorState;
  timeout?: number;
}

export interface BrowserGetByRoleOptions {
  name?: string | RegExp;
  exact?: boolean;
}

export interface BrowserGetByTextOptions {
  exact?: boolean;
}

export interface BrowserPagePort {
  goto(url: string, options?: BrowserGotoOptions): Promise<void>;
  waitForTimeout(milliseconds: number): Promise<void>;
  evaluate<TResult, TArgs extends unknown[]>(pageFunction: (...args: TArgs) => TResult | Promise<TResult>, ...args: TArgs): Promise<TResult>;
  $eval<TResult, TArgs extends unknown[]>(selector: string, pageFunction: (element: HTMLElement, ...args: TArgs) => TResult | Promise<TResult>, ...args: TArgs): Promise<TResult>;
  waitForSelector(selector: string, options?: BrowserWaitForSelectorOptions): Promise<BrowserElementPort | null>;
  $(selector: string): Promise<BrowserElementPort | null>;
  $$(selector: string): Promise<BrowserElementPort[]>;
  getByRole(role: string, options?: BrowserGetByRoleOptions): BrowserLocatorPort;
  getByText(text: string, options?: BrowserGetByTextOptions): BrowserLocatorPort;
  url(): string;
  once(event: 'close', handler: () => void): void;
  pause(): Promise<void>;
}
