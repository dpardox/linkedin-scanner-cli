import { JobStatus } from '@enums/job-status.enum';

export type Job = {
  id: string;
  title: string;
  description: string;
  location: string;
  url: string;
  date: Date;
  status: JobStatus;
};

https://forms.gle/rsNjeEjjNAhm8b8k7
