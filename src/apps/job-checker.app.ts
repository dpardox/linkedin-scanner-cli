import { jobSearchConfigs } from '@config/main.config';
import { JobsSearchPage } from '@core/pages/jobs-search.page';
import { LoginPage } from '@core/pages/login.page';
import { matchWholeWord } from '@utils/match-whole-word.util';
import { SearchResultsContentPage } from '@core/pages/searchResultsContent.page';
import { JobAnalyzerAI } from '@core/ai/job-analyzer.ai';
import { NotifierPort } from '@ports/notifier.port';
import { LoggerPort } from '@ports/logger.port';
import { JobStatus } from '@enums/job-status.enum';
import { normalize } from '@utils/normalize.util';
import { JobSearchConfig } from '@shared/types/job-search-config.type';
import { JobModel } from '@models/job.model';
import { JobDatasource } from '@infrastructure/datasource/job.datasource';
import { sleep } from '@utils/sleep.util';
import { BrowserPort } from '@ports/browser.port';
import { LangDetectorPort } from '@ports/lang-detector.port';

export class JobCheckerApp {

  private readonly jobDatasource = new JobDatasource();

  private jobsSearchPage!: JobsSearchPage;

  constructor (
    private readonly logger: LoggerPort,
    private readonly notifier: NotifierPort,
    private readonly browser: BrowserPort,
    private readonly langDetector: LangDetectorPort,
  ) { }

  public async run(): Promise<void> {
    try {
      await this.launch();
    } catch (error) {
      this.logger.error('%s', error);
      console.error({ error });
      await this.browser.close();
      process.exit(1);
    } finally {
      await this.browser.close();
      const minutes = 5;
      this.logger.br();
      this.logger.warn('Waiting %d minutes before next run...', minutes);
      await sleep(minutes * 60 * 1000);
      this.logger.br();
      await this.run();
      // TODO (dpardo): in the second run, set presume fitness to true
    }
  }

  public async launch(): Promise<void> {
    await this.browser.launch({ headless: false });

    for (const config of jobSearchConfigs) {
      this.logger.br();
      await this.processConfig(config);
    }

    const searchResultsContentPage = new SearchResultsContentPage(await this.browser.firstPage(), this.logger);
    this.notifier.notify();
    await searchResultsContentPage.open();

    await this.browser.close();
  }

  private async processConfig(config: JobSearchConfig): Promise<void> {
    const { query, location, filters } = config;

    this.jobsSearchPage = new JobsSearchPage(await this.browser.firstPage(), this.logger);
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
    let jobIds = await this.jobsSearchPage.getJobIds();

    const ids = [];

    for (const jobId of jobIds) {
      const job = await this.jobDatasource.findById(jobId);
      if (job && job.status !== JobStatus.pending) {
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

  private async checkJob(jobId: string, config: JobSearchConfig): Promise<void> {
    const jobModel = await this.getJobDetails(jobId);

    if (await this.isDissmissedJob(jobId)) return;
    if (await this.isAppliedJob(jobId)) return;
    if (!await this.hasValidLanguage(jobModel)) return;
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
      this.jobDatasource.update(jobId, { status: JobStatus.dissmissed });
      return true;
    };
    return false;
  }

  private async isAppliedJob(jobId: string): Promise<boolean> {
    this.logger.info('Checking if job "%s" is applied...', jobId);
    if (await this.jobsSearchPage.isAppliedJob(jobId)) {
      this.logger.warn(`You already applied to job "%s".`, jobId);
      this.jobDatasource.update(jobId, { status: JobStatus.dissmissed });
      return true;
    }
    return false;
  }

  private async hasValidLanguage(job: JobModel, languages: string[] = ['eng', 'spa']): Promise<boolean> {
    this.logger.info('Checking if job "%s" has valid language...', job.id);

    const language = job.language(this.langDetector);// TODO (dpardo): languages in the config

    if (!languages.includes(language)) {
      this.logger.error('Job "%s" has invalid language: %s', job.id, language);
      this.jobDatasource.update(job.id, { status: JobStatus.dissmissed });
      return false;
    }

    return true;
  }

  private async getJobFitness(job: JobModel, config: JobSearchConfig): Promise<boolean> {
    this.logger.info('Checking if job "%s" is a good fit...', job.id);

    if (await this.jobIsClosed(job)) return false;
    if (await this.jobHasRestrictedLocations(job, config.restrictedLocations)) return false;
    if (await this.jobHasStrictExcludedWords(job, config.keywords.strictExclude)) return false;
    if (await this.jobHasStrictIncludeWords(job, config.keywords.strictInclude)) return true;
    if (await this.jobHasHighSkillsMatch(job)) return true;

    await this.IACheck(job);

    this.markJobAsUndetermined(job);
    return false;
  }

  private async jobIsClosed(job: JobModel): Promise<boolean> {
    if (job.isClosed) {
      this.logger.error('Job "%s" is closed!', job.id);
      await this.skipJob(job);
      return true;
    }
    return false;
  }

  private async jobHasRestrictedLocations(job: JobModel, restrictedLocations: string[]): Promise<boolean> {
    const location = normalize(job.location);
    const hasRestrictedLocations = restrictedLocations.some(x => location?.includes(normalize(x)));

    if (hasRestrictedLocations) {
      this.logger.error('Job "%s" has restricted location: %s', job.id, job.location);
      await this.skipJob(job);
      return true;
    }
    return false;
  }

  private async jobHasStrictExcludedWords(job: JobModel, strictExcludedWords: string[]): Promise<boolean> {
    const hasStrictExcludedWords = strictExcludedWords.some(x => matchWholeWord(job.fullDescription, x));

    if (hasStrictExcludedWords) {
      const matchedKeywords = strictExcludedWords.filter(x => matchWholeWord(job.fullDescription, x));
      this.logger.error('Job "%s" has strict excluded words: %O', job.id, matchedKeywords);
      await this.skipJob(job);
      return true;
    }
    return false;
  }

  private async jobHasHighSkillsMatch(job: JobModel): Promise<boolean> {
    if (job.highSkillsMatch) {
      this.logger.success('Job "%s" has high skills match!', job.id);
      return true;
    }
    return false;
  }

  private markJobAsUndetermined(job: JobModel): void {
    this.logger.info('Marking job "%s" as indeterminate...', job.id);
    this.jobDatasource.update(job.id, { status: JobStatus.undetermined });
  }

  private async jobHasStrictIncludeWords(job: JobModel, strictIncludeWords: string[]): Promise<boolean> {
    const hasStrictIncludeWords = strictIncludeWords.some(x => matchWholeWord(job.fullDescription, x));

    if (hasStrictIncludeWords) {
      const matchedKeywords = strictIncludeWords.filter(x => matchWholeWord(job.fullDescription, x));
      this.logger.success('Job "%s" has strict include words: %O', job.id, matchedKeywords);
      return true;
    }
    return false;
  }

  private async IACheck(job: JobModel): Promise<void> {
    this.logger.info('Checking if job "%s" is AI generated...', job.id);
    const jobAnalyzerAI = new JobAnalyzerAI(this.logger);
    await jobAnalyzerAI.chat(job.description);
    // const gptResponse = await jobAnalyzerAI.chat(raw.content);

    // if (gptResponse) {
    //   Log.info('AI analysis: %O', gptResponse);
    //   // Log.info('AI analysis: %s', gptResponse?.output_text?.trim());
    // }
  }

  private async skipJob(job: JobModel): Promise<void> {
    this.logger.info('Skipping job "%s"...', job.title);
    this.jobDatasource.update(job.id, { status: JobStatus.dissmissed });
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
    this.jobsSearchPage.markJobForReview(job.id);
    this.notifier.notify();
    await this.jobsSearchPage.waitForJobToBeDismissed(job.id);
    this.jobDatasource.update(job.id, { status: JobStatus.dissmissed });
  }

}


// TODO (dpardo): doesn't dissmiss the job use the database to check if the job was already processed
// TODO (dpardo): clean the database after one week
// TODO (dpardo): on error re-run n times (.env)
