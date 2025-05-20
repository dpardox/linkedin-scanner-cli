import { JobsViewPage } from '@core/pages/jobs-view.page';
import { JobStatus } from '@enums/job-status.enum';
import { LangDetector } from '@interfaces/lang-detector.interface';
import { Job } from '@shared/types/job.type';
import { extractEmails } from '@utils/extract-emails.util';
import { normalize } from '@utils/normalize.util';

export class JobModel implements Job {

  public id: string;
  public title: string;
  public description: string;
  public location: string;
  public highSkillsMatch: boolean;
  public isClosed: boolean;
  public status: JobStatus;
  public createdAt: Date = new Date();

  constructor(data?: Partial<Job>) {
    this.id = data?.id ?? '';
    this.title = data?.title ?? '';
    this.description = data?.description ?? '';
    this.location = data?.location ?? '';
    this.createdAt = data?.createdAt || new Date();
    this.highSkillsMatch = data?.highSkillsMatch || false;
    this.isClosed = data?.isClosed || false;
    this.status = data?.status ?? JobStatus.pending;
  }

  get link(): string {
    return `${JobsViewPage.url}/${this.id}/`;
  }

  get emails(): string[] {
    return extractEmails(this.description);
  }

  get fullDescription(): string {
    return `${this.title} ${this.description}`;
  }

  public language(detector: LangDetector): string {
    return detector.detect(normalize(this.description.slice(0, 500)));
  }

}
