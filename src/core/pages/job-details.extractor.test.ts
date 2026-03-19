import { describe, expect, test, vi } from 'vitest';
import { BrowserPagePort } from '@ports/browser-page.port';
import { LoggerPort } from '@ports/logger.port';
import { JobDetailsExtractor } from './job-details.extractor';

describe('JobDetailsExtractor', () => {

  test('should throw a selector extraction error when required fields stay missing', async () => {
    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn(),
      $eval: vi.fn(),
      waitForSelector: vi.fn(),
      $: vi.fn().mockResolvedValue(null),
      $$: vi.fn(),
      getByRole: vi.fn(),
      getByText: vi.fn(),
      title: vi.fn(),
      content: vi.fn().mockResolvedValue('<html></html>'),
      screenshot: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://www.linkedin.com/jobs/search/?currentJobId=4377411406'),
      once: vi.fn(),
      pause: vi.fn(),
    } as unknown as BrowserPagePort;

    const logger: LoggerPort = {
      setContext: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      forYou: vi.fn(),
      br: vi.fn(),
    };

    const extractor = new JobDetailsExtractor(page, logger);

    await expect(extractor.extract('4377411406', { timeoutMs: 0, captureArtifacts: false }))
      .rejects
      .toThrow('Missing required fields: title, description');
  });

});
