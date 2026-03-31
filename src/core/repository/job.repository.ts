import { JobModel } from '@models/job.model';
import { JobStatus } from '@enums/job-status.enum';

export abstract class JobRepository {

  abstract exists(id: string): Promise<boolean>;

  abstract findById(id: string): Promise<JobModel | null>;

  abstract findByStatus(status: JobStatus): Promise<JobModel[]>;

  abstract save(data: JobModel): Promise<JobModel>;

  abstract update(id: string, data: Partial<JobModel>): Promise<JobModel | null>;

  abstract upsert(id: string, data: Partial<JobModel>): Promise<JobModel>;

  abstract remove(id: string): Promise<JobModel | null>;

}
