import { Location } from '@enums/location.enum';
import { Filters } from './filters.type';
import { Keywords } from './keywords';

export type JobSearchConfig = {
  query: string;
  location: Location;
  restrictedLocations: string[];
  filters: Filters;
  keywords: Keywords;
};
