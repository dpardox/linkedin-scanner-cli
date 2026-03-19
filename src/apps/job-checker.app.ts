import { contentSearchQuery, defaultJobSearchFilters, jobSearchConfigs, runUndetermined } from '@config/main.config';
import { JobsSearchPage } from '@core/pages/jobs-search.page';
import { LoginPage } from '@core/pages/login.page';
import { matchWholeWord } from '@utils/match-whole-word.util';
import { SearchResultsContentPage } from '@core/pages/searchResultsContent.page';
import { NotifierPort } from '@ports/notifier.port';
import { LoggerPort } from '@ports/logger.port';
import { JobStatus } from '@enums/job-status.enum';
import { normalize } from '@utils/normalize.util';
import { ExpandedJobSearchConfig, JobSearchConfig } from '@shared/types/job-search-config.type';
import { JobModel } from '@models/job.model';
import { BrowserPort } from '@ports/browser.port';
import { LangDetectorPort } from '@ports/lang-detector.port';
import { JobRepository } from '@repository/job.repository';
import { JobDetailsExtractionError } from '@core/pages/job-details-extraction.error';
import { TimePostedRange } from '@enums/time-posted-range.enum';


export class JobCheckerApp {

  private static readonly automaticTimePostedRanges: TimePostedRange[] = [
    TimePostedRange.day,
    TimePostedRange.week,
    TimePostedRange.month,
  ];

  private jobsSearchPage!: JobsSearchPage;
  private loginPage!: LoginPage;

  private showUndetermined: boolean = false;

  constructor (
    private readonly logger: LoggerPort,
    private readonly notifier: NotifierPort,
    private readonly browser: BrowserPort,
    private readonly langDetector: LangDetectorPort,
    private readonly jobRepository: JobRepository,
  ) { }

  public async run(): Promise<void> {
    try {
      this.showUndetermined = false;
      this.logger.setContext({ runMode: 'default', phase: 'Starting run', jobId: undefined });
      await this.tryRun();

      if (runUndetermined) {
        this.logger.br();
        this.logger.success('Second run including UNDETERMINED jobs!');
        this.logger.br();

        this.showUndetermined = true;
        this.logger.setContext({ runMode: 'undetermined', phase: 'Starting second run', jobId: undefined });
        await this.tryRun();
      }

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

  public async tryRun(): Promise<void> {
    this.logger.setContext({ phase: 'Launching browser', jobId: undefined });
    await this.browser.launch({ headless: false });

    const firstPage = await this.browser.firstPage();
    this.loginPage = new LoginPage(firstPage, this.logger);
    await this.ensureAuthenticated();
    this.jobsSearchPage = new JobsSearchPage(firstPage, this.logger);

    const expandedConfigs = this.expandConfigs(jobSearchConfigs);
    await this.runJobSearches(expandedConfigs);

    const searchResultsContentPage = new SearchResultsContentPage(await this.browser.firstPage(), this.logger);
    this.logger.setContext({
      phase: 'Opening content search',
      searchQuery: contentSearchQuery,
      location: undefined,
      jobId: undefined,
    });
    this.notifier.notify();
    await searchResultsContentPage.open(contentSearchQuery);
    this.logger.setContext({ phase: 'Waiting for manual close' });
    await searchResultsContentPage.waitForManualClose();

    this.logger.setContext({ phase: 'Closing browser', jobId: undefined });
    await this.browser.close();
  }

  private expandConfigs(configs: JobSearchConfig[]): ExpandedJobSearchConfig[] {
    return configs.flatMap(config => {
      const { locations } = config;
      const mergedFilters = {
        ...defaultJobSearchFilters,
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

  private async runJobSearches(configs: ExpandedJobSearchConfig[]): Promise<void> {
    for (const timePostedRange of JobCheckerApp.automaticTimePostedRanges) {
      for (const config of configs) {
        this.logger.br();
        await this.jobSearchByTimePostedRange(config, timePostedRange);
      }
    }
  }

  private async jobSearchByTimePostedRange(
    config: ExpandedJobSearchConfig,
    timePostedRange: TimePostedRange,
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
      if (await this.noJobsFound()) break;
      const jobIds = await this.getJobIds();

      for (const jobId of jobIds) {
        this.logger.setContext({ phase: 'Reviewing job', jobId });
        this.logger.br();
        try {
          await this.jobsSearchPage.markJobAsCurrent(jobId);
          await this.checkJob(jobId, config);
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

    const statuses = [JobStatus.pending];
    this.showUndetermined && statuses.push(JobStatus.undetermined);

    const ids: string[] = [];

    for (const jobId of jobIds) {
      const job = await this.jobRepository.findById(jobId);
      if (job && !statuses.includes(job.status)) {
        this.logger.br();
        this.logger.warn('Job "%s" already processed!', jobId);
        await this.jobsSearchPage.markJobAsSeen(jobId);
        continue;
      }

      if (await this.jobsSearchPage.isEmptyJob(jobId)) continue;

      ids.push(jobId);
    }

    return ids;
  }

  private async checkJob(jobId: string, config: ExpandedJobSearchConfig): Promise<void> {
    this.logger.setContext({ phase: 'Evaluating job', jobId });
    const jobModel = await this.getJobDetails(jobId);

    if (await this.isDissmissedJob(jobId)) return;
    if (await this.isAppliedJob(jobId)) return;
    if (!await this.hasValidLanguage(jobModel, config.languages)) return;
    if (!await this.getJobFitness(jobModel, config)) return;

    this.showPotentialMatch(jobModel);
    await this.markForManualCheck(jobModel);
  }

  private async getJobDetails(jobId: string): Promise<JobModel> {
    this.logger.setContext({ phase: 'Extracting job details', jobId });
    await this.jobsSearchPage.selectJob(jobId);
    const jobModel = await this.jobsSearchPage.getJobDetails(jobId);
    return await this.jobRepository.upsert(jobId, jobModel);
  }

  private async isDissmissedJob(jobId: string): Promise<boolean> {
    this.logger.info('Checking if job "%s" is dissmissed...', jobId);
    if (await this.jobsSearchPage.isDissmissedJob(jobId)) {
      await this.updateJobStatus(jobId, JobStatus.dissmissed);
      return true;
    };
    return false;
  }

  private async isAppliedJob(jobId: string): Promise<boolean> {
    this.logger.info('Checking if job "%s" is applied...', jobId);
    if (await this.jobsSearchPage.isAppliedJob(jobId)) {
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
      this.logger.error('Job "%s" has invalid language: %s', job.id, language);
      await this.updateJobStatus(job.id, JobStatus.dissmissed);
      return false;
    }

    return true;
  }

  private async getJobFitness(job: JobModel, config: ExpandedJobSearchConfig): Promise<boolean> {
    this.logger.info('Checking if job "%s" is a good fit...', job.id);

    if (await this.jobIsClosed(job)) return false;
    if (await this.jobHasRestrictedLocations(job, config.restrictedLocations)) return false;
    if (await this.jobHasStrictExcludedWords(job, config.keywords.strictExclude)) return false;
    if (await this.jobHasStrictIncludeWords(job, config.keywords.strictInclude)) return true;
    if (await this.jobHasHighSkillsMatch(job)) return true;
    return await this.checkUndeterminedJob(job);
  }

  private async jobIsClosed(job: JobModel): Promise<boolean> {
    if (job.isClosed) {
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
      this.logger.error('Job "%s" has restricted location: %s', job.id, job.location);
      await this.skipJob(job);
      return true;
    }
    return false;
  }

  private async jobHasStrictExcludedWords(job: JobModel, strictExcludedWords: string[] = []): Promise<boolean> {
    const matchedKeywords = this.findMatchingKeywords(job.fullDescription, strictExcludedWords);

    if (!matchedKeywords.length) return false;

    this.logger.error('Job "%s" has strict excluded words: %O', job.id, matchedKeywords);
    await this.skipJob(job);
    return true;
  }

  private async jobHasStrictIncludeWords(job: JobModel, strictIncludeWords: string[] = []): Promise<boolean> {
    const matchedKeywords = this.findMatchingKeywords(job.fullDescription, strictIncludeWords);

    if (!matchedKeywords.length) return false;

    this.logger.success('Job "%s" has strict include words: %O', job.id, matchedKeywords);
    return true;
  }

  private async jobHasHighSkillsMatch(job: JobModel): Promise<boolean> {
    if (job.highSkillsMatch) {
      this.logger.success('Job "%s" has high skills match!', job.id);
      return true;
    }
    return false;
  }

  private async skipJob(job: JobModel): Promise<void> {
    this.logger.setContext({ phase: 'Skipping job', jobId: job.id });
    this.logger.info('Skipping job "%s"...', job.title);
    await this.updateJobStatus(job.id, JobStatus.dissmissed);
  }

  private async checkUndeterminedJob(job: JobModel): Promise<boolean> {
    this.logger.info('Checking if job "%s" is a undetermined...', job.id);
    if (!this.showUndetermined) await this.markJobAsUndetermined(job);
    this.showUndetermined && this.logger.warn('Job "%s" is undetermined!', job.id);
    return this.showUndetermined;
  }

  private async markJobAsUndetermined(job: JobModel): Promise<void> {
    this.logger.setContext({ phase: 'Marking undetermined', jobId: job.id });
    this.logger.warn('Marking job "%s" as undetermined...', job.id);
    await this.updateJobStatus(job.id, JobStatus.undetermined);
  }

  private showPotentialMatch(job: JobModel): void {
    this.logger.setContext({ phase: 'Potential match found', jobId: job.id });
    this.logger.info('Potential match found!');
    const { id, title, link, location, emails } = job;

    this.logger.forYou({
      id,
      title,
      link,
      location,
      emails,
      language: job.language(this.langDetector),
    });
  }

  private async markForManualCheck(job: JobModel): Promise<void> {
    this.logger.setContext({ phase: 'Waiting manual review', jobId: job.id });
    this.logger.info('Marking job "%s" for manual check...', job.id);
    await this.jobsSearchPage.markJobForReview(job.id);
    this.notifier.notify();
    await this.jobsSearchPage.waitForJobToBeDismissed(job.id);
    await this.updateJobStatus(job.id, JobStatus.dissmissed);
    this.logger.success('Job "%s" reviewed!', job.title);
  }

  private async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    await this.jobRepository.update(jobId, { status });
  }

  private findMatchingKeywords(content: string, keywords: string[] = []): string[] {
    return keywords.filter(keyword => matchWholeWord(content, keyword));
  }

}
