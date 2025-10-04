import { JobModel } from '@models/job.model';
import { JobRepository } from '@repository/job.repository';
import { JSONStorageAdapter } from '@adapters/json-storage.adapter';
import { Job } from '@shared/types/job.type';

export class JobDatasource extends JobRepository {

  private readonly storage = new JSONStorageAdapter<Job, string>('jobs', { ttlDays: 30 });

  public async exists(id: string): Promise<boolean> {
    return this.storage.exists(id);
  }

  public async findById(id: string): Promise<JobModel | null> {
    const job = this.storage.findById(id);
    return job ? new JobModel(job) : null;
  }

  public async save(data: JobModel): Promise<JobModel> {
    return new JobModel(this.storage.create(data));
  }

  public async update(id: string, data: Partial<JobModel>): Promise<JobModel | null> {
    const job = this.storage.update(id, data);
    return job ? new JobModel(job) : null;
  }

  public async upsert(id: string, data: Partial<JobModel>): Promise<JobModel> {
    return new JobModel(this.storage.upsert(id, data));
  }

  public async remove(id: string): Promise<JobModel | null> {
    const job = this.storage.delete(id);
    return job ? new JobModel(job) : null;
  }

}
