export interface BrowserLocatorFilterOptions {
  hasText?: string | RegExp;
}

export interface BrowserLocatorPort {
  isVisible(): Promise<boolean>;
  filter(options: BrowserLocatorFilterOptions): BrowserLocatorPort;
}
