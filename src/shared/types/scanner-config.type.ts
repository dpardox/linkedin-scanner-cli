import { Filters } from './filters.type';
import { JobSearchConfig } from './job-search-config.type';

export type ScannerConfig = {
  defaultJobSearchFilters: Filters;
  jobSearchConfigs: JobSearchConfig[];
  contentSearchQuery: string;
};
