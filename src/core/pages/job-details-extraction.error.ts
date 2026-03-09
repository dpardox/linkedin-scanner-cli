import {
  JobDetailsFieldName,
  JobDetailsFieldSelectorConfig,
  JobDetailsSnapshot,
} from './job-details.selectors';

export class JobDetailsExtractionError extends Error {

  constructor(
    public readonly jobId: string,
    public readonly snapshot: JobDetailsSnapshot,
    selectorConfig: Record<JobDetailsFieldName, JobDetailsFieldSelectorConfig>,
  ) {
    super(JobDetailsExtractionError.buildMessage(jobId, snapshot, selectorConfig));
    this.name = 'JobDetailsExtractionError';
  }

  private static buildMessage(
    jobId: string,
    snapshot: JobDetailsSnapshot,
    selectorConfig: Record<JobDetailsFieldName, JobDetailsFieldSelectorConfig>,
  ): string {
    const missingFields = this.getMissingFields(snapshot, selectorConfig).join(', ');
    const matchedSelectors = this.getMatchedSelectors(snapshot);
    const configuredSelectors = this.getConfiguredSelectors(selectorConfig);

    return `Job details extraction failed for "${jobId}" at ${snapshot.url}. Missing required fields: ${missingFields}. Matched selectors: ${matchedSelectors}. Configured selectors: ${configuredSelectors}`;
  }

  private static getMissingFields(
    snapshot: JobDetailsSnapshot,
    selectorConfig: Record<JobDetailsFieldName, JobDetailsFieldSelectorConfig>,
  ): JobDetailsFieldName[] {
    const fields = Object.keys(selectorConfig) as JobDetailsFieldName[];
    return fields.filter((field) => selectorConfig[field].required && !snapshot.fields[field].value);
  }

  private static getMatchedSelectors(snapshot: JobDetailsSnapshot): string {
    const fields = Object.keys(snapshot.fields) as JobDetailsFieldName[];
    return fields
      .map((field) => `${field}=${snapshot.fields[field].selector ?? 'none'}`)
      .join(', ');
  }

  private static getConfiguredSelectors(selectorConfig: Record<JobDetailsFieldName, JobDetailsFieldSelectorConfig>): string {
    const fields = Object.keys(selectorConfig) as JobDetailsFieldName[];
    return fields
      .map((field) => `${field}=[${selectorConfig[field].selectors.join(', ')}]`)
      .join('; ');
  }

}
