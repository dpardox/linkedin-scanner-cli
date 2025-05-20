import { JobModel } from '@models/job.model';

export abstract class JobStorage {

  abstract exists(id: string): Promise<boolean>;

  abstract findById(id: string): Promise<JobModel | null>;

  abstract save(data: JobModel): Promise<JobModel>;

  abstract update(id: string, data: Partial<JobModel>): Promise<JobModel | null>;

  abstract upsert(id: string, data: Partial<JobModel>): Promise<JobModel | null>;

  abstract remove(id: string): Promise<JobModel | null>;

}
