import { Page } from 'playwright';

export interface Browser {
  lunch(): Promise<void>;
  close(): Promise<void>;
  page(index?: number): Promise<Page>;
}
