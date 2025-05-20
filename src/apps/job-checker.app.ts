import { jobSearchConfigs } from '@config/main.config';
import { JobsSearchPage } from '@core/pages/jobs-search.page';
import { ChromiumBrowser } from '@core/browsers/chromium.browser';
import { LoginPage } from '@core/pages/login.page';
import { matchWholeWord } from '@utils/match-whole-word.util';
import { SearchResultsContentPage } from '@core/pages/searchResultsContent.page';
import { JobAnalyzerAI } from '@core/ai/job-analyzer.ai';
import { Notifier } from '@interfaces/notifier.interface';
import { Logger } from '@interfaces/logger.interface';
import { Job } from '@shared/types/job.type';
import { StoragePlugin } from '@plugins/storage.plugin';
import { JobStatus } from '@enums/job-status.enum';
import { FrancPlugin } from '@plugins/franc.plugin';
import { normalize } from '@utils/normalize.util';

export class JobCheckerApp {

  private readonly chromium = new ChromiumBrowser(this.logger);
  private readonly jobStorage = new StoragePlugin<Job>('job');
  private readonly language = new FrancPlugin();

  constructor (
    private readonly notifier: Notifier,
    private readonly logger: Logger,
  ) { }

  public async run(): Promise<void> {
    await this.chromium.lunch();

    this.logger.br();

    if (!await this.signIn()) return;

    this.logger.br();

    for (const config of jobSearchConfigs) {
      const { query, location, restrictedLocations, filters, keywords } = config;

      const jobsSearchPage = new JobsSearchPage(await this.chromium.firstPage(), this.logger);
      await jobsSearchPage.open(query, location, filters);

      do {
        this.logger.br();
        if (await jobsSearchPage.noJobsFound()) break;

        let jobs = await jobsSearchPage.getJobs();

        for (const job of jobs) {
          this.logger.br();

          const jobEntry = this.jobStorage.findById(job);
          if (jobEntry && jobEntry.status !== JobStatus.pending) {
            this.logger.warn('Job "%s" already processed!', job);
            continue;
          }

          if (await jobsSearchPage.isEmptyJob(job)) continue;

          await jobsSearchPage.selectJob(job);

          const { id, title, link, country, content, description, emails, highSkillsMatch, isClosed, raw } = await jobsSearchPage.getJobDetails(job); // TODO (dpardo): use job type

          this.jobStorage.upsert(id, {
            title: raw.title,
            location: raw.country,
            description: raw.content, // TODO (dpardo): remove
            url: link,
            date: new Date(),
            status: JobStatus.pending,
            // TODO (dpardo): add other fields
          });

          if (await jobsSearchPage.isDissmissedJob(job)) {
            this.jobStorage.update(id, { status: JobStatus.dissmissed });
            continue;
          };

          if (await jobsSearchPage.isAppliedJob(job)) {
            this.jobStorage.update(id, { status: JobStatus.dissmissed });
            continue;
          };

          const language = this.language.detect(content);
          this.logger.info(`Language detected: ${language}`);

          // TODO (dpardo): dismiss if language is not in config (eng - spa)
          // TODO (dpardo): create enum for languages

          const { strictInclude, include, exclude, strictExclude } = keywords;

          const hasStrictIncludeWords = strictInclude.some((word) => matchWholeWord(description, word));
          const hasIncludeWords = include.some((word) => matchWholeWord(description, word));
          const hasExcludedWords = exclude.some((word) => matchWholeWord(description, word));
          const hasStrictExcludedWords = strictExclude.some((word) => matchWholeWord(description, word));
          const hasRestrictedLocations = restrictedLocations.some((location) => country?.includes(normalize(location)));

          const matchedKeywords = {
            strictInclude: strictInclude.filter((word) => matchWholeWord(description, word)),
            include: include.filter((word) => matchWholeWord(description, word)),
            exclude: exclude.filter((word) => matchWholeWord(description, word)),
            strictExclude: strictExclude.filter((word) => matchWholeWord(description, word)),
          };

          highSkillsMatch && this.logger.success('High skills match found: %s', highSkillsMatch);
          hasStrictIncludeWords && this.logger.success('Strict include words found: %o', matchedKeywords.strictInclude);
          // hasIncludeWords && Log.success('Include words found: %o', matchedKeywords.include);
          // hasExcludedWords && Log.warn('Excluded words found: %o', matchedKeywords.exclude);
          hasStrictExcludedWords && this.logger.error('Strict excluded words found: %o', matchedKeywords.strictExclude);
          hasRestrictedLocations && this.logger.error('Restricted locations found: %s', country);

          const skip =  !(hasStrictIncludeWords || highSkillsMatch) || hasStrictExcludedWords || hasRestrictedLocations || isClosed;

          if (skip) {
            this.logger.warn('❌ Not for you "%s"', title);
            await jobsSearchPage.dissmissJob(job);
            this.jobStorage.update(id, { status: JobStatus.dissmissed });
            continue;
          };

          this.logger.success('✅ For you "%s"', title);
          this.notifier.notify();

          this.logger.info('Job information "%O"', {
            id,
            title,
            link,
            country,
            emails,
            language,
          });

          // AI
          const jobAnalyzerAI = new JobAnalyzerAI(this.logger);
          await jobAnalyzerAI.chat(raw.content);
          // const gptResponse = await jobAnalyzerAI.chat(raw.content);

          // if (gptResponse) {
          //   Log.info('AI analysis: %O', gptResponse);
          //   // Log.info('AI analysis: %s', gptResponse?.output_text?.trim());
          // }

          await jobsSearchPage.waitForJobToBeDismissed(job);
          this.jobStorage.update(id, { status: JobStatus.dissmissed });
        }

        this.logger.br();
      } while (await jobsSearchPage.nextPage());

      this.logger.br();

      // await jobsSearchPage.close();
    }

    const searchResultsContentPage = new SearchResultsContentPage(await this.chromium.firstPage(), this.logger);
    this.notifier.notify();
    await searchResultsContentPage.open();

    await this.chromium.close();
    process.exit(0);
  }

  public async signIn(): Promise<boolean> {
    const loginPage = new LoginPage(await this.chromium.firstPage(), this.logger);
    await loginPage.open();

    if (!loginPage.isAuthenticated()) {
      this.logger.error('🔐 Session not detected. Please login to LinkedIn.');
      await this.chromium.close();
      return false;
    }

    return true;
  }

}
