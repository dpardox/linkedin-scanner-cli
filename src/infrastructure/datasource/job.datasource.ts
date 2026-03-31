import { JobModel } from '@models/job.model';
import { JobRepository } from '@repository/job.repository';
import { JSONStorageAdapter } from '@adapters/json-storage.adapter';
import { Job } from '@shared/types/job.type';
import { JobStatus } from '@enums/job-status.enum';

export class JobDatasource extends JobRepository {

  // TODO (dpardo): Move the job retention TTL to scanner configuration so deduplication can be adjusted without code changes.
  private readonly storage = new JSONStorageAdapter<Job, string>('jobs', { ttlDays: 30 });

  public async exists(id: string): Promise<boolean> {
    return this.storage.exists(id);
  }

  public async findById(id: string): Promise<JobModel | null> {
    const job = this.storage.findById(id);
    return job ? new JobModel(job) : null;
  }

  public async findByStatus(status: JobStatus): Promise<JobModel[]> {
    return this.storage
      .findAll()
      .filter((job) => job.status === status)
      .map((job) => new JobModel(job));
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
