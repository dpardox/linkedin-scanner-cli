import fs from 'node:fs';
import path from 'node:path';
import { LoggerPort } from '@ports/logger.port';
import { BrowserPagePort } from '@ports/browser-page.port';
import {
  jobDetailsFieldSelectors,
  JobDetailsFieldName,
  JobDetailsFieldSnapshot,
  JobDetailsSnapshot,
} from './job-details.selectors';
import { JobDetailsExtractionError } from './job-details-extraction.error';

type ExtractJobDetailsOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  captureArtifacts?: boolean;
};

type ExtractionArtifacts = {
  directory: string;
  htmlPath: string;
  screenshotPath: string;
  snapshotPath: string;
};

export class JobDetailsExtractor {

  private static readonly artifactBaseDir = path.resolve(process.cwd(), 'logs', 'job-details-extraction');

  constructor(
    private readonly page: BrowserPagePort,
    private readonly logger: LoggerPort,
  ) { }

  public async extract(jobId: string, options: ExtractJobDetailsOptions = {}): Promise<JobDetailsSnapshot> {
    const {
      timeoutMs = 30_000,
      intervalMs = 500,
      captureArtifacts = true,
    } = options;

    const startedAt = Date.now();
    let snapshot = await this.readJobDetails();

    while (Date.now() - startedAt < timeoutMs) {
      if (this.hasRequiredJobDetails(snapshot)) {
        return snapshot;
      }

      await this.page.waitForTimeout(intervalMs);
      snapshot = await this.readJobDetails();
    }

    const artifacts = captureArtifacts ? await this.captureArtifacts(jobId, snapshot) : null;

    if (artifacts) {
      this.logger.warn('Saved extraction artifacts for job "%s" at %s', jobId, artifacts.directory);
    }

    throw new JobDetailsExtractionError(
      jobId,
      snapshot,
      jobDetailsFieldSelectors,
      artifacts?.directory,
    );
  }

  private async readJobDetails(): Promise<JobDetailsSnapshot> {
    const [title, location, description] = await Promise.all([
      this.readJobDetailField('title'),
      this.readJobDetailField('location'),
      this.readJobDetailField('description'),
    ]);

    return {
      url: this.page.url(),
      fields: {
        title,
        location,
        description,
      },
    };
  }

  private hasRequiredJobDetails(snapshot: JobDetailsSnapshot): boolean {
    const fields = Object.keys(jobDetailsFieldSelectors) as JobDetailsFieldName[];
    return fields.every((field) => {
      const { required } = jobDetailsFieldSelectors[field];
      return !required || !!snapshot.fields[field].value;
    });
  }

  private async readJobDetailField(field: JobDetailsFieldName): Promise<JobDetailsFieldSnapshot> {
    const { selectors } = jobDetailsFieldSelectors[field];
    return await this.readFirstAvailableText(selectors);
  }

  private async readFirstAvailableText(selectors: string[]): Promise<JobDetailsFieldSnapshot> {
    for (const selector of selectors) {
      const value = await this.readTextBySelector(selector);

      if (value) {
        return {
          value,
          selector,
        };
      }
    }

    return {
      value: '',
      selector: null,
    };
  }

  private async readTextBySelector(selector: string): Promise<string> {
    const element = await this.page.$(selector);

    if (!element) {
      return '';
    }

    try {
      return (await element.innerText()).trim();
    } catch {
      return '';
    }
  }

  private async captureArtifacts(jobId: string, snapshot: JobDetailsSnapshot): Promise<ExtractionArtifacts> {
    const directory = path.join(
      JobDetailsExtractor.artifactBaseDir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${jobId}`,
    );

    fs.mkdirSync(directory, { recursive: true });

    const htmlPath = path.join(directory, 'page.html');
    const screenshotPath = path.join(directory, 'page.png');
    const snapshotPath = path.join(directory, 'snapshot.json');

    const [htmlResult, screenshotResult] = await Promise.allSettled([
      this.page.content(),
      this.page.screenshot(screenshotPath),
    ]);

    if (htmlResult.status === 'fulfilled') {
      fs.writeFileSync(htmlPath, htmlResult.value, 'utf-8');
    } else {
      this.logger.warn('Unable to capture page HTML for job "%s": %s', jobId, this.getErrorMessage(htmlResult.reason));
    }

    if (screenshotResult.status === 'rejected') {
      this.logger.warn('Unable to capture screenshot for job "%s": %s', jobId, this.getErrorMessage(screenshotResult.reason));
    }

    fs.writeFileSync(snapshotPath, JSON.stringify({
      jobId,
      capturedAt: new Date().toISOString(),
      snapshot,
      configuredSelectors: jobDetailsFieldSelectors,
    }, null, 2), 'utf-8');

    return {
      directory,
      htmlPath,
      screenshotPath,
      snapshotPath,
    };
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

}
