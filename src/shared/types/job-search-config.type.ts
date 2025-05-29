import { Location } from '@enums/location.enum';
import { Filters } from './filters.type';
import { Keywords } from './keywords';

export type JobSearchConfig = {
  query: string;
  locations: Location[];
  restrictedLocations: string[];
  filters: Filters;
  keywords: Keywords;
};

export type ExpandedJobSearchConfig = Omit<JobSearchConfig, 'locations'> & {
  location: Location;
};
