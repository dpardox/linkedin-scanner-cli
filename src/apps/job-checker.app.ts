import { jobSearchConfigs } from '@config/main.config';
import { JobsSearchPage } from '@core/pages/jobs-search.page';
import { ChromiumBrowser } from '@core/browsers/chromium.browser';
import { LoginPage } from '@core/pages/login.page';
import { matchWholeWord } from '@utils/match-whole-word.util';
import { SearchResultsContentPage } from '@core/pages/searchResultsContent.page';
import { JobAnalyzerAI } from '@core/ai/job-analyzer.ai';
import { Notifier } from '@interfaces/notifier.interface';
import { Logger } from '@interfaces/logger.interface';
import { JobStatus } from '@enums/job-status.enum';
import { FrancPlugin } from '@plugins/franc.plugin';
import { normalize } from '@utils/normalize.util';
import { JobSearchConfig } from '@shared/types/job-search-config.type';
import { JobModel } from '@models/job.model';
import { JobDatasource } from '@infrastructure/datasource/job.datasource';
import { sleep } from '@utils/sleep.util';

export class JobCheckerApp {

  private readonly chromium = new ChromiumBrowser(this.logger);
  private readonly langDetector = new FrancPlugin();
  private readonly jobDatasource = new JobDatasource();

  private jobsSearchPage!: JobsSearchPage;

  constructor (
    private readonly notifier: Notifier,
    private readonly logger: Logger,
  ) { }

  public async run(): Promise<void> {
    try {
      await this.lunch();
    } catch (error) {
      this.logger.error('Error: %s', error);
      await this.chromium.close();
      process.exit(1);
    } finally {
      await this.chromium.close();
      const minutes = 5;
      this.logger.br();
      this.logger.warn('Waiting %d minutes before next run...', minutes);
      await sleep(minutes * 60 * 1000);
      this.logger.br();
    }
  }

  public async lunch(): Promise<void> {
    await this.chromium.lunch();

    this.logger.br();

    if (!await this.signIn()) return;

    for (const config of jobSearchConfigs) {
      this.logger.br();
      await this.processConfig(config);
    }

    const searchResultsContentPage = new SearchResultsContentPage(await this.chromium.firstPage(), this.logger);
    this.notifier.notify();
    await searchResultsContentPage.open();

    await this.chromium.close();
    process.exit(0);
  }

  private async signIn(): Promise<boolean> {
    const loginPage = new LoginPage(await this.chromium.firstPage(), this.logger);
    await loginPage.open();

    if (!loginPage.isAuthenticated()) {
      this.logger.error('🔐 Session not detected. Please login to LinkedIn.');
      await this.chromium.close();
      return false;
    }

    return true;
  }

  private async processConfig(config: JobSearchConfig): Promise<void> {
    const { query, location, filters } = config;

    // TODO (dpardo): plugin to chromium and here use the port
    this.jobsSearchPage = new JobsSearchPage(await this.chromium.firstPage(), this.logger);
    await this.jobsSearchPage.open(query, location, filters);

    do {
      this.logger.br();
      if (await this.noJobsFound()) break;
      const jobIds = await this.getJobIds();

      for (const jobId of jobIds) {
        this.logger.br();

        const jobModel = await this.getJobDetails(jobId);

        if (await this.isDissmissedJob(jobId)) continue;
        if (await this.isAppliedJob(jobId)) continue;
        if (!await this.hasValidLanguage(jobModel)) continue;
        if (!await this.getJobFitness(jobModel, config)) continue;
        await this.showPotentialMatch(jobModel);
        await this.markForManualCheck(jobModel);
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
        continue;
      }

      if (await this.jobsSearchPage.isEmptyJob(jobId)) continue;

      ids.push(jobId);
    }

    return ids;
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
      this.jobDatasource.update(jobId, { status: JobStatus.dissmissed });
      return true;
    }
    return false;
  }

  private async hasValidLanguage(job: JobModel, languages: string[] = ['eng', 'spa']): Promise<boolean> {
    this.logger.info('Checking if job "%s" has valid language...', job.id);
    // TODO (dpardo): languages in the config
    const language = job.language(this.langDetector);

    if (!languages.includes(language)) {
      this.logger.error('Job "%s" has invalid language: %s', job.id, language);
      await this.jobsSearchPage.dissmissJob(job.id);
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
    if (await this.jobHasHighSkillsMatch(job)) return true;
    if (await this.jobHasStrictIncludeWords(job, config.keywords.strictInclude)) return true;

    await this.IACheck(job);

    this.logger.error('Job "%s" no matching criteria were met!', job.id);
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
    await this.jobsSearchPage.dissmissJob(job.id);
    this.jobDatasource.update(job.id, { status: JobStatus.dissmissed });
  }

  private async showPotentialMatch(job: JobModel): Promise<void> {
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
    this.notifier.notify();
    await this.jobsSearchPage.waitForJobToBeDismissed(job.id);
    this.jobDatasource.update(job.id, { status: JobStatus.dissmissed });
  }

}
