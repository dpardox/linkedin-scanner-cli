import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { ChromiumAdapter } from './chromium.adapter';
import { LoggerPort } from '../ports/logger.port';

describe('ChromiumAdapter', () => {

  let adapter: ChromiumAdapter;

  const logger: LoggerPort = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    success: vi.fn(),
    br: vi.fn(),
  };

  beforeAll(async () => {
    adapter = new ChromiumAdapter(logger);
    await adapter.launch({ headless: true });
  });

  afterAll(async () => {
    await adapter.close();
  });

  test('should launch browser and create first page', async () => {
    const page = await adapter.firstPage();
    expect(page).toBeDefined();

    await page.goto('https://example.com');
    const title = await page.title();
    expect(title).toContain('Example');
  });

  test('should launch browser and create last page', async () => {
    const page = await adapter.lastPage();
    expect(page).toBeDefined();
  });

  test('should create new page', async () => {
    const page = await adapter.newPage();
    expect(page).toBeDefined();
  });

});
