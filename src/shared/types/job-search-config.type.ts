import { Location } from '@enums/location.enum';
import { Filters } from './filters.type';
import { Keywords } from './keywords';

export type JobSearchConfig = {
  query: string;
  location: Location; // TODO (dpardo): support multiple locations
  restrictedLocations: string[];
  filters: Filters;
  keywords: Keywords;
};
