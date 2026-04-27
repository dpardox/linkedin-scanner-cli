import { Location } from '@enums/location.enum';
import { PersistedJobRuleManager, getPersistedJobRuleManager } from '@config/rules';
import { Filters } from '@shared/types/filters.type';
import { JobSearchConfig } from '@shared/types/job-search-config.type';
import { ScannerConfig } from '@shared/types/scanner-config.type';
import { ScannerPreferences } from '@shared/types/scanner-preferences.type';

export const defaultJobSearchFilters: Filters = {};

export function createScannerConfig(
  preferences: ScannerPreferences,
  ruleManager: PersistedJobRuleManager = getPersistedJobRuleManager(),
): ScannerConfig {
  return {
    defaultJobSearchFilters,
    jobSearchConfigs: createJobSearchConfigs(preferences, ruleManager),
    contentSearchQuery: preferences.contentSearchQuery,
  };
}

function createJobSearchConfigs(
  preferences: ScannerPreferences,
  ruleManager: PersistedJobRuleManager,
): JobSearchConfig[] {
  return preferences.searchQueries.map((query) => ({
    query,
    locations: preferences.locationKeys.map((locationKey) => Location[locationKey]),
    restrictedLocations: [...preferences.restrictedLocations],
    filters: {
      ...preferences.filters,
    },
    keywords: ruleManager.createKeywords({
      includeRuleIds: preferences.includeRuleIds,
      excludeRuleIds: preferences.excludeRuleIds,
      includeKeywords: preferences.includeKeywords,
      excludeKeywords: preferences.excludeKeywords,
    }),
    languages: [...preferences.languages],
  }));
}
