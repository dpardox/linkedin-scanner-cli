import { LanguageCode } from '@enums/language-code.enum';
import { WorkType } from '@enums/work-type.enum';
import { ScannerPreferences } from '@shared/types/scanner-preferences.type';
import { restrictedLocationsKeywords } from './keywords/restricted-locations.keywords';
import { additionalExcludeKeywordRuleIds } from './rules/default-persisted-job-rules';

export const defaultScannerPreferences: ScannerPreferences = {
  searchQueries: ['"angular"', 'angular'],
  locationKeys: [
    'worldwide',
    'spain',
    'mexico',
    'argentina',
    'colombia',
    'miami',
    'morocco',
    'uruguay',
    'panama',
    'costaRica',
    'dominicanRepublic',
    'puertoRico',
    'chile',
    'equatorialGuinea',
    'latinAmerica',
  ],
  languages: [LanguageCode.spanish],
  restrictedLocations: [...restrictedLocationsKeywords],
  filters: {
    workType: WorkType.remote,
    easyApply: true,
  },
  includeRuleIds: ['angular'],
  excludeRuleIds: [
    'english',
    'dotnet',
    ...additionalExcludeKeywordRuleIds,
    'us-citizenship',
  ],
  includeKeywords: [],
  excludeKeywords: [],
  contentSearchQuery: '"desarrollador angular"',
  showUnknownJobs: false,
};
