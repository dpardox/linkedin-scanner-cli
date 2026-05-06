import { Location } from '@enums/location.enum';
import { WorkType } from '@enums/work-type.enum';

export type LocationKey = keyof typeof Location;

export type ScannerPreferences = {
  searchQueries: string[];
  strictSearchMode: boolean;
  locationKeys: LocationKey[];
  languages: string[];
  filters: {
    workType?: WorkType;
    easyApply?: boolean;
  };
  includeRuleIds: string[];
  excludeRuleIds: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  contentSearchQuery: string;
  showUnknownJobs: boolean;
};
