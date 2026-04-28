import { JobsSearchPage } from '@core/pages/jobs-search.page';
import { LoginPage } from '@core/pages/login.page';
import { matchWholeWord } from '@utils/match-whole-word.util';
import { SearchResultsContentPage } from '@core/pages/searchResultsContent.page';
import { InteractionPort } from '@ports/interaction.port';
import { NotifierPort } from '@ports/notifier.port';
import { LoggerPort } from '@ports/logger.port';
import { JobStatus } from '@enums/job-status.enum';
import { normalize } from '@utils/normalize.util';
import { ExpandedJobSearchConfig, JobSearchConfig } from '@shared/types/job-search-config.type';
import { ExecutionOptions } from '@shared/types/execution-options.type';
import { Filters } from '@shared/types/filters.type';
import { JobModel } from '@models/job.model';
import { BrowserPort } from '@ports/browser.port';
import { LangDetectorPort } from '@ports/lang-detector.port';
import { JobRepository } from '@repository/job.repository';
import { JobDetailsExtractionError } from '@core/pages/job-details-extraction.error';
import { TimePostedRange } from '@enums/time-posted-range.enum';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';
import { UndeterminedQueueEntry } from '@shared/types/undetermined-queue-entry.type';
import { ScannerConfig } from '@shared/types/scanner-config.type';
import { randms } from '@utils/randms.util';
import { sleep } from '@utils/sleep.util';

type JobMatchClassification = 'include' | 'exclude' | 'unknown';

type JobMatchEvaluation = {
  classification: JobMatchClassification;
  criteria: string[];
};

export class JobCheckerApp {

  private static readonly automaticTimePostedRanges: TimePostedRange[] = [
    TimePostedRange.day,
    TimePostedRange.week,
    TimePostedRange.month,
  ];

  private static readonly noJobsFoundHumanDelayFromSeconds = 6;
  private static readonly noJobsFoundHumanDelayToSeconds = 14;

  private jobsSearchPage!: JobsSearchPage;
  private loginPage!: LoginPage;

  constructor (
    private readonly logger: LoggerPort,
    private readonly interaction: InteractionPort,
    private readonly notifier: NotifierPort,
    private readonly browser: BrowserPort,
    private readonly langDetector: LangDetectorPort,
    private readonly jobRepository: JobRepository,
  ) { }

  public async run(scannerConfig: ScannerConfig, executionOptions: ExecutionOptions): Promise<void> {
    try {
      this.logger.setContext({
        runMode: 'default',
        phase: 'Starting run',
        jobId: undefined,
      });
      await this.tryRun(scannerConfig, executionOptions);

      this.logger.setContext({ phase: 'Finished', jobId: undefined });
      this.logger.success('Execution finished!');

    } catch (error) {
      this.logger.setContext({ phase: 'Handling failure' });
      let browserClosed = false;
      try {
        browserClosed = this.browser.isClosed();
      } catch {
        browserClosed = true;
      }

      if (browserClosed) {
        this.logger.warn('Execution finished by user.');
        process.exit(1);
        return;
      }

      if (error instanceof JobDetailsExtractionError) {
        this.logger.error('Job details extraction stopped on job "%s". Review selectors in the paused browser.', error.jobId);
      } else {
        this.logger.error('An error occurred during the job checking process...');
      }
      console.error(error);

      try {
        const page = await this.browser.lastPage();
        this.notifier.notify();
        await page.pause();
        await this.browser.close();
      } catch (cleanupError) {
        this.logger.warn('Unable to complete cleanup after error.');
        console.error(cleanupError);
      }

      process.exit(1);
    }
  }

  public async tryRun(scannerConfig: ScannerConfig, executionOptions: ExecutionOptions): Promise<void> {
    this.logger.setContext({
      phase: 'Launching browser',
      jobId: undefined,
    });
    await this.browser.launch({ headless: false });

    const firstPage = await this.browser.firstPage();
    this.loginPage = new LoginPage(firstPage, this.logger);
    await this.ensureAuthenticated();
    this.jobsSearchPage = new JobsSearchPage(firstPage, this.logger);

    const expandedConfigs = this.expandConfigs(scannerConfig.jobSearchConfigs, scannerConfig.defaultJobSearchFilters);
    await this.runJobSearches(expandedConfigs, executionOptions);

    const searchResultsContentPage = new SearchResultsContentPage(await this.browser.firstPage(), this.logger);
    this.logger.setContext({
      phase: 'Opening content search',
      runMode: 'default',
      searchQuery: scannerConfig.contentSearchQuery,
      location: undefined,
      jobId: undefined,
    });
    this.notifier.notify();
    await searchResultsContentPage.open(scannerConfig.contentSearchQuery);
    this.logger.setContext({ phase: 'Waiting for manual close' });
    await searchResultsContentPage.waitForManualClose();

    this.logger.setContext({ phase: 'Closing browser', jobId: undefined });
    await this.browser.close();
  }

  private expandConfigs(configs: JobSearchConfig[], defaultFilters: Filters = {}): ExpandedJobSearchConfig[] {
    return configs.flatMap(config => {
      const { locations } = config;
      const mergedFilters = {
        ...defaultFilters,
        ...config.filters,
      };
      const { timePostedRange: _ignoredTimePostedRange, ...filters } = mergedFilters;

      return locations.map(location => ({
        ...config,
        filters,
        location,
      }));
    });
  }

  private async runJobSearches(configs: ExpandedJobSearchConfig[], executionOptions: ExecutionOptions): Promise<void> {
    for (const timePostedRange of JobCheckerApp.automaticTimePostedRanges) {
      for (const config of configs) {
        this.logger.br();
        await this.jobSearchByTimePostedRange(config, timePostedRange, executionOptions);
      }
    }
  }

  private async jobSearchByTimePostedRange(
    config: ExpandedJobSearchConfig,
    timePostedRange: TimePostedRange,
    executionOptions: ExecutionOptions,
  ): Promise<void> {
    const { query, location, filters } = config;
    const timePostedRangeLabel = this.describeTimePostedRange(timePostedRange);
    this.logger.setContext({
      phase: `Opening jobs search (${timePostedRangeLabel})`,
      searchQuery: query,
      location,
      jobId: undefined,
    });
    this.logger.info('Running jobs search for %s...', timePostedRangeLabel);
    await this.jobsSearchPage.open(query, location, {
      ...filters,
      timePostedRange,
    });

    do {
      this.logger.setContext({ phase: `Scanning jobs list (${timePostedRangeLabel})`, jobId: undefined });
      this.logger.br();
      if (await this.noJobsFound()) {
        await this.waitBeforeNextSearchAfterNoJobsFound();
        break;
      }
      const jobIds = await this.getJobIds();

      for (const jobId of jobIds) {
        this.logger.setContext({ phase: 'Reviewing job', jobId });
        this.logger.br();
        try {
          await this.jobsSearchPage.markJobAsCurrent(jobId);
          await this.checkJob(jobId, config, executionOptions);
        } catch (error) {
          if (error instanceof JobDetailsExtractionError) {
            throw error;
          }

          const message = error instanceof Error ? error.message : String(error);
          this.logger.error('Unable to process job "%s": %s', jobId, message);
          if (!this.loginPage.isAuthenticated()) {
            await this.ensureAuthenticated();
          }
          this.logger.setContext({ phase: 'Recovering search results', jobId });
          await this.jobsSearchPage.recoverSearchResults();
        } finally {
          await this.jobsSearchPage.markJobAsSeen(jobId);
        }

      }
    } while (await this.jobsSearchPage.nextPage());

    this.logger.setContext({ phase: `Search completed (${timePostedRangeLabel})`, jobId: undefined });
  }

  private async waitBeforeNextSearchAfterNoJobsFound(): Promise<void> {
    this.logger.setContext({ phase: 'Waiting before next search', jobId: undefined });
    this.logger.info('Waiting before next search...');
    await sleep(randms(
      JobCheckerApp.noJobsFoundHumanDelayFromSeconds,
      JobCheckerApp.noJobsFoundHumanDelayToSeconds,
    ));
  }

  private describeTimePostedRange(timePostedRange: TimePostedRange): string {
    switch (timePostedRange) {
      case TimePostedRange.day:
        return 'last day';
      case TimePostedRange.week:
        return 'last week';
      case TimePostedRange.month:
        return 'last month';
      default:
        return 'custom range';
    }
  }

  private async noJobsFound(): Promise<boolean> {
    return await this.jobsSearchPage.noJobsFound();
  }

  private async ensureAuthenticated(): Promise<void> {
    this.logger.setContext({ phase: 'Authenticating session' });
    await this.loginPage.ensureAuthenticated(async () => {
      await this.browser.clearCookies();
    });
    await this.browser.saveSessionState();
  }

  private async getJobIds(): Promise<string[]> {
    const jobIds = await this.jobsSearchPage.getJobIds();

    const ids: string[] = [];

    for (const jobId of jobIds) {
      const job = await this.jobRepository.findById(jobId);
      if (job && job.status !== JobStatus.pending) {
        this.logger.br();
        this.logger.countJob?.('skipped');
        this.logger.warn('Job "%s" already processed!', jobId);
        await this.jobsSearchPage.markJobAsSeen(jobId);
        continue;
      }

      if (await this.jobsSearchPage.isEmptyJob(jobId)) {
        this.logger.countJob?.('skipped');
        continue;
      }

      ids.push(jobId);
    }

    return ids;
  }

  private async checkJob(jobId: string, config: ExpandedJobSearchConfig, executionOptions: ExecutionOptions): Promise<void> {
    this.logger.setContext({ phase: 'Evaluating job', jobId });
    const jobModel = await this.getJobDetails(jobId);

    if (await this.isDissmissedJob(jobId)) return;
    if (await this.isAppliedJob(jobId)) return;
    if (!await this.hasValidLanguage(jobModel, config.languages)) return;

    const jobMatchEvaluation = await this.evaluateJobMatch(jobModel, config);

    if (jobMatchEvaluation.classification === 'exclude') {
      return;
    }

    if (jobMatchEvaluation.classification === 'include') {
      const manualReviewEntry = this.showPotentialMatch(jobModel, jobMatchEvaluation.criteria, 'include');
      await this.markForManualCheck(jobModel, manualReviewEntry);
      return;
    }

    if (!executionOptions.showUnknownJobs) {
      await this.markUndeterminedJob(jobModel);
      return;
    }

    await this.markUndeterminedJobForManualCheck(jobModel);
  }

  private async getJobDetails(jobId: string): Promise<JobModel> {
    this.logger.setContext({ phase: 'Extracting job details', jobId });
    await this.jobsSearchPage.selectJob(jobId);
    const jobModel = await this.jobsSearchPage.getJobDetails(jobId);
    return await this.serializeJob(jobId, async () => await this.jobRepository.upsert(jobId, jobModel));
  }

  private async serializeJob<T>(jobId: string, action: () => Promise<T>): Promise<T> {
    return await this.interaction.runAction({
      runningText: `Serializing job "${jobId}"`,
      successText: `Serialized job "${jobId}"`,
      failureText: `Failed to serialize job "${jobId}"`,
    }, action);
  }

  private async isDissmissedJob(jobId: string): Promise<boolean> {
    this.logger.info('Checking if job "%s" is dissmissed...', jobId);
    if (await this.jobsSearchPage.isDissmissedJob(jobId)) {
      this.logger.countJob?.('skipped');
      await this.updateJobStatus(jobId, JobStatus.dissmissed);
      return true;
    };
    return false;
  }

  private async isAppliedJob(jobId: string): Promise<boolean> {
    this.logger.info('Checking if job "%s" is applied...', jobId);
    if (await this.jobsSearchPage.isAppliedJob(jobId)) {
      this.logger.countJob?.('discarded');
      this.logger.warn(`You already applied to job "%s".`, jobId);
      await this.updateJobStatus(jobId, JobStatus.dissmissed);
      return true;
    }
    return false;
  }

  private async hasValidLanguage(job: JobModel, languages: string[] = []): Promise<boolean> {
    this.logger.info('Checking if job "%s" has valid language...', job.id);

    const language = job.language(this.langDetector);

    const allowedLanguages = languages.length ? languages : ['eng', 'spa'];

    if (!allowedLanguages.includes(language)) {
      this.logger.countJob?.('discarded');
      this.logger.error('Job "%s" has invalid language: %s', job.id, language);
      await this.updateJobStatus(job.id, JobStatus.dissmissed);
      return false;
    }

    return true;
  }

  private async evaluateJobMatch(job: JobModel, config: ExpandedJobSearchConfig): Promise<JobMatchEvaluation> {
    this.logger.info('Checking if job "%s" is a good fit...', job.id);

    if (await this.jobIsClosed(job)) {
      return {
        classification: 'exclude',
        criteria: [],
      };
    }

    if (await this.jobHasRestrictedLocations(job, config.restrictedLocations)) {
      return {
        classification: 'exclude',
        criteria: [],
      };
    }

    const excludeMatches = this.getMatchingKeywords(job.fullDescription, config.keywords.exclude);

    if (excludeMatches.length) {
      await this.discardJobByExcludeTerms(job, excludeMatches);
      return {
        classification: 'exclude',
        criteria: excludeMatches,
      };
    }

    const includeMatches = this.getIncludeMatches(job, config.keywords.include);

    if (includeMatches.length) {
      return {
        classification: 'include',
        criteria: includeMatches,
      };
    }

    return {
      classification: 'unknown',
      criteria: [],
    };
  }

  private async jobIsClosed(job: JobModel): Promise<boolean> {
    if (job.isClosed) {
      this.logger.countJob?.('discarded');
      this.logger.error('Job "%s" is closed!', job.id);
      await this.skipJob(job);
      return true;
    }
    return false;
  }

  private async jobHasRestrictedLocations(job: JobModel, restrictedLocations: string[] = []): Promise<boolean> {
    const location = normalize(job.location);
    const hasRestrictedLocations = restrictedLocations.some(x => location?.includes(normalize(x)));

    if (hasRestrictedLocations) {
      this.logger.countJob?.('discarded');
      this.logger.error('Job "%s" has restricted location: %s', job.id, job.location);
      await this.skipJob(job);
      return true;
    }
    return false;
  }

  private async discardJobByExcludeTerms(job: JobModel, excludeTerms: string[]): Promise<void> {
    this.logger.countJob?.('discarded');
    this.logger.error('Job "%s" has exclude words: %O', job.id, excludeTerms);
    await this.skipJob(job);
  }

  private getIncludeMatches(job: JobModel, includeWords: string[] = []): string[] {
    const matchedKeywords = this.getMatchingKeywords(job.fullDescription, includeWords);

    if (!matchedKeywords.length) return [];

    this.logger.success('Job "%s" has include words: %O', job.id, matchedKeywords);
    return matchedKeywords;
  }

  private async skipJob(job: JobModel): Promise<void> {
    this.logger.setContext({ phase: 'Skipping job', jobId: job.id });
    this.logger.info('Skipping job "%s"...', job.title);
    await this.updateJobStatus(job.id, JobStatus.dissmissed);
  }

  private async markUndeterminedJobForManualCheck(job: JobModel): Promise<void> {
    await this.markUndeterminedJob(job);
    this.logger.trackUndetermined?.(this.createUndeterminedQueueEntry(job));
    const manualReviewEntry = this.showPotentialMatch(job, ['Unknown'], 'unknown');
    await this.markForManualCheck(job, manualReviewEntry);
  }

  private async markUndeterminedJob(job: JobModel): Promise<void> {
    this.logger.setContext({ phase: 'Marking undetermined', jobId: job.id });
    this.logger.countJob?.('undetermined');
    this.logger.warn('Marking job "%s" as undetermined...', job.id);
    await this.updateJobStatus(job.id, JobStatus.undetermined);
  }

  private showPotentialMatch(
    job: JobModel,
    criteria: string[],
    classification: ManualReviewEntry['classification'],
  ): ManualReviewEntry {
    this.logger.setContext({ phase: 'Potential match found', jobId: job.id });
    this.logger.countJob?.('found');
    this.logger.info('Potential match found!');
    const manualReviewEntry = this.createManualReviewEntry(job, criteria, classification);

    this.logger.forYou({
      id: manualReviewEntry.id,
      title: manualReviewEntry.title,
      link: manualReviewEntry.link,
      location: manualReviewEntry.location,
      emails: manualReviewEntry.emails,
      language: manualReviewEntry.language,
      criteria: manualReviewEntry.criteria,
    });

    return manualReviewEntry;
  }

  private async markForManualCheck(job: JobModel, manualReviewEntry: ManualReviewEntry): Promise<void> {
    this.logger.setContext({ runMode: 'manual-review', phase: 'Waiting manual review', jobId: job.id });
    this.logger.info('Marking job "%s" for manual check...', job.id);
    this.interaction.startManualReview(manualReviewEntry);
    await this.jobsSearchPage.markJobForReview(job.id);
    this.notifier.notify();
    try {
      await this.jobsSearchPage.waitForJobToBeDismissed(job.id);
    } finally {
      this.interaction.finishManualReview(job.id);
    }
    this.logger.setContext({ runMode: 'default', phase: 'Resuming scan', jobId: job.id });
    await this.updateJobStatus(job.id, JobStatus.dissmissed);
    this.logger.success('Job "%s" reviewed!', job.title);
  }

  private async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    await this.serializeJob(jobId, async () => {
      await this.jobRepository.update(jobId, { status });
    });
  }

  private createUndeterminedQueueEntry(job: JobModel): UndeterminedQueueEntry {
    return {
      id: job.id,
      title: job.title,
      location: job.location,
      link: job.link,
      decision: 'pending',
    };
  }

  private createManualReviewEntry(
    job: JobModel,
    criteria: string[],
    classification: ManualReviewEntry['classification'],
  ): ManualReviewEntry {
    return {
      id: job.id,
      title: job.title,
      link: job.link,
      location: job.location,
      emails: job.emails,
      language: job.language(this.langDetector),
      criteria,
      classification,
      defaultRuleScope: classification === 'include' ? 'include' : 'exclude',
    };
  }

  private getMatchingKeywords(content: string, keywords: string[] = []): string[] {
    return keywords.filter(keyword => matchWholeWord(content, keyword));
  }

}
