import { JobStatus } from '@enums/job-status.enum';

export type Job = {
  id: string;
  title: string;
  description: string;
  location: string;
  highSkillsMatch: boolean;
  isClosed: boolean;
  status: JobStatus;
  createdAt: Date;
};
