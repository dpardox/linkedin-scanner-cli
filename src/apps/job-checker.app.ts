import { contentSearchQuery, jobSearchConfigs, runUndetermined } from '@config/main.config';
import { JobsSearchPage } from '@core/pages/jobs-search.page';
import { matchWholeWord } from '@utils/match-whole-word.util';
import { SearchResultsContentPage } from '@core/pages/searchResultsContent.page';
import { NotifierPort } from '@ports/notifier.port';
import { LoggerPort } from '@ports/logger.port';
import { JobStatus } from '@enums/job-status.enum';
import { normalize } from '@utils/normalize.util';
import { ExpandedJobSearchConfig, JobSearchConfig } from '@shared/types/job-search-config.type';
import { JobModel } from '@models/job.model';
import { JobDatasource } from '@infrastructure/datasource/job.datasource';
import { BrowserPort } from '@ports/browser.port';
import { LangDetectorPort } from '@ports/lang-detector.port';


export class JobCheckerApp {

  private readonly jobDatasource = new JobDatasource();

  private jobsSearchPage!: JobsSearchPage;

  private showUndetermined: boolean = false;

  constructor (
    private readonly logger: LoggerPort,
    private readonly notifier: NotifierPort,
    private readonly browser: BrowserPort,
    private readonly langDetector: LangDetectorPort,
  ) { }

  public async run(): Promise<void> {
    try {
      this.showUndetermined = false;
      await this.tryRun();

      if (runUndetermined) {
        this.logger.br();
        this.logger.success('Second run including UNDETERMINED jobs!');
        this.logger.br();

        this.showUndetermined = true;
        await this.tryRun();
      }

      this.logger.success('Execution finished!');

    } catch (error) {
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

      this.logger.error('An error occurred during the job checking process...');
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
    await this.browser.launch({ headless: false });

    this.jobsSearchPage = new JobsSearchPage(await this.browser.firstPage(), this.logger);

    const expandedConfigs = this.expandConfigs(jobSearchConfigs);

    for (const config of expandedConfigs) {
      this.logger.br();
      await this.jobSearch(config);
    }

    const searchResultsContentPage = new SearchResultsContentPage(await this.browser.firstPage(), this.logger);
    this.notifier.notify();
    await searchResultsContentPage.open(contentSearchQuery);
    await searchResultsContentPage.waitForManualClose();

    await this.browser.close();
  }

  private expandConfigs(configs: JobSearchConfig[]): ExpandedJobSearchConfig[] {
    return configs.flatMap(config => {
      const { locations } = config;
      return locations.map(location => ({
        ...config,
        location,
      }));
    });
  }

  private async jobSearch(config: ExpandedJobSearchConfig): Promise<void> {
    const { query, location, filters } = config;
    await this.jobsSearchPage.open(query, location, filters);

    do {
      this.logger.br();
      if (await this.noJobsFound()) break;
      const jobIds = await this.getJobIds();

      for (const jobId of jobIds) {
        this.logger.br();
        await this.jobsSearchPage.markJobAsCurrent(jobId);
        await this.checkJob(jobId, config);
        await this.jobsSearchPage.markJobAsSeen(jobId);

      }
    } while (await this.jobsSearchPage.nextPage());
  }

  private async noJobsFound(): Promise<boolean> {
    return await this.jobsSearchPage.noJobsFound();
  }

  private async getJobIds(): Promise<string[]> {
    const jobIds = await this.jobsSearchPage.getJobIds();

    const statuses = [JobStatus.pending];
    this.showUndetermined && statuses.push(JobStatus.undetermined);

    const ids: string[] = [];

    for (const jobId of jobIds) {
      const job = await this.jobDatasource.findById(jobId);
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
    const jobModel = await this.getJobDetails(jobId);

    if (await this.isDissmissedJob(jobId)) return;
    if (await this.isAppliedJob(jobId)) return;
    if (!await this.hasValidLanguage(jobModel, config.languages)) return;
    if (!await this.getJobFitness(jobModel, config)) return;

    this.showPotentialMatch(jobModel);
    await this.markForManualCheck(jobModel);
  }

  private async getJobDetails(jobId: string): Promise<JobModel> {
    await this.jobsSearchPage.selectJob(jobId);
    const jobModel = await this.jobsSearchPage.getJobDetails(jobId);
    return await this.jobDatasource.upsert(jobId, jobModel);
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
    this.logger.warn('Marking job "%s" as undetermined...', job.id);
    await this.updateJobStatus(job.id, JobStatus.undetermined);
  }

  private showPotentialMatch(job: JobModel): void {
    this.logger.info('Potential match found!');
    const { id, title, link, location, emails } = job;

    this.logger.success('For you  "%O"', {
      id,
      title,
      link,
      location,
      emails,
      language: job.language(this.langDetector),
    });
  }

  private async markForManualCheck(job: JobModel): Promise<void> {
    this.logger.info('Marking job "%s" for manual check...', job.id);
    await this.jobsSearchPage.markJobForReview(job.id);
    this.notifier.notify();
    await this.jobsSearchPage.waitForJobToBeDismissed(job.id);
    await this.updateJobStatus(job.id, JobStatus.dissmissed);
    this.logger.success('Job "%s" reviewed!', job.title);
  }

  private async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    await this.jobDatasource.update(jobId, { status });
  }

  private findMatchingKeywords(content: string, keywords: string[] = []): string[] {
    return keywords.filter(keyword => matchWholeWord(content, keyword));
  }

}
