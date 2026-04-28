import fs from 'fs';
import path from 'path';
import { ScannerPreferencesPath } from '@enums/scanner-preferences-path.enum';
import { LocationKey, ScannerPreferences } from '@shared/types/scanner-preferences.type';
import { type JobRuleScope } from './rules';
import { defaultScannerPreferences } from './default-scanner-preferences';

type ScannerPreferencesFileRepositoryOptions = {
  directoryPath?: string;
  legacyFilePath?: string;
};

type SearchQueryRecord = {
  query: string;
};

type LocationRecord = {
  key: LocationKey;
};

type LanguageRecord = {
  code: string;
};

type RestrictedLocationRecord = {
  location: string;
};

type RuleSelectionRecord = {
  scope: JobRuleScope;
  ruleId: string;
};

type AdditionalKeywordRecord = {
  scope: JobRuleScope;
  keyword: string;
};

type ContentSearchRecord = {
  query: string;
};

type ExecutionOptionsRecord = {
  showUnknownJobs: boolean;
};

type ScannerPreferencesFiles = {
  searchQueries: string;
  locations: string;
  languages: string;
  restrictedLocations: string;
  ruleSelections: string;
  additionalKeywords: string;
  filters: string;
  contentSearch: string;
  executionOptions: string;
};

export class ScannerPreferencesFileRepository {

  private readonly directoryPath: string;
  private readonly legacyFilePath: string;

  constructor(options: ScannerPreferencesFileRepositoryOptions = {}) {
    this.directoryPath = path.resolve(process.cwd(), options.directoryPath ?? ScannerPreferencesPath.directory);
    this.legacyFilePath = path.resolve(process.cwd(), options.legacyFilePath ?? ScannerPreferencesPath.legacyFile);
  }

  public hasPreferences(): boolean {
    return this.hasDatabasePreferences() || fs.existsSync(this.legacyFilePath);
  }

  public read(): ScannerPreferences {
    if (this.hasDatabasePreferences()) {
      return this.readDatabasePreferences();
    }

    if (fs.existsSync(this.legacyFilePath)) {
      return this.readLegacyPreferences();
    }

    return defaultScannerPreferences;
  }

  public write(preferences: ScannerPreferences): void {
    if (!fs.existsSync(this.directoryPath)) {
      fs.mkdirSync(this.directoryPath, { recursive: true });
    }

    this.writeJsonLines(this.files.searchQueries, preferences.searchQueries.map((query) => ({ query })));
    this.writeJsonLines(this.files.locations, preferences.locationKeys.map((key) => ({ key })));
    this.writeJsonLines(this.files.languages, preferences.languages.map((code) => ({ code })));
    this.writeJsonLines(this.files.restrictedLocations, preferences.restrictedLocations.map((location) => ({ location })));
    this.writeJsonLines(this.files.ruleSelections, this.createRuleSelectionRecords(preferences));
    this.writeJsonLines(this.files.additionalKeywords, this.createAdditionalKeywordRecords(preferences));
    this.writeJson(this.files.filters, preferences.filters);
    this.writeJson(this.files.contentSearch, { query: preferences.contentSearchQuery });
    this.writeJson(this.files.executionOptions, { showUnknownJobs: preferences.showUnknownJobs });
  }

  public addAdditionalKeyword(scope: JobRuleScope, keyword: string): ScannerPreferences {
    const cleanedKeyword = keyword.trim().replace(/\s+/g, ' ');
    const preferences = this.read();

    if (!cleanedKeyword) {
      return preferences;
    }

    const updatedPreferences = this.createPreferencesWithAdditionalKeyword(preferences, scope, cleanedKeyword);
    this.write(updatedPreferences);
    return updatedPreferences;
  }

  private readDatabasePreferences(): ScannerPreferences {
    const ruleSelections = this.readJsonLines<RuleSelectionRecord>(this.files.ruleSelections);
    const additionalKeywords = this.readJsonLines<AdditionalKeywordRecord>(this.files.additionalKeywords);
    const contentSearch = this.readJson<Partial<ContentSearchRecord>>(this.files.contentSearch, {});
    const executionOptions = this.readJson<Partial<ExecutionOptionsRecord>>(this.files.executionOptions, {});

    return this.mergePreferences({
      searchQueries: this.readJsonLines<SearchQueryRecord>(this.files.searchQueries).map(({ query }) => query),
      locationKeys: this.readJsonLines<LocationRecord>(this.files.locations).map(({ key }) => key),
      languages: this.readJsonLines<LanguageRecord>(this.files.languages).map(({ code }) => code),
      restrictedLocations: this.readJsonLines<RestrictedLocationRecord>(this.files.restrictedLocations).map(({ location }) => location),
      filters: this.readJson<ScannerPreferences['filters']>(this.files.filters, {}),
      includeRuleIds: this.getRuleSelectionValues(ruleSelections, 'include'),
      excludeRuleIds: this.getRuleSelectionValues(ruleSelections, 'exclude'),
      includeKeywords: this.getAdditionalKeywordValues(additionalKeywords, 'include'),
      excludeKeywords: this.getAdditionalKeywordValues(additionalKeywords, 'exclude'),
      contentSearchQuery: contentSearch.query,
      showUnknownJobs: executionOptions.showUnknownJobs,
    });
  }

  private readLegacyPreferences(): ScannerPreferences {
    const parsedPreferences = JSON.parse(fs.readFileSync(this.legacyFilePath, 'utf-8')) as Partial<ScannerPreferences>;
    return this.mergePreferences(parsedPreferences);
  }

  private createRuleSelectionRecords(preferences: ScannerPreferences): RuleSelectionRecord[] {
    return [
      ...preferences.includeRuleIds.map((ruleId) => ({
        scope: 'include' as const,
        ruleId,
      })),
      ...preferences.excludeRuleIds.map((ruleId) => ({
        scope: 'exclude' as const,
        ruleId,
      })),
    ];
  }

  private createAdditionalKeywordRecords(preferences: ScannerPreferences): AdditionalKeywordRecord[] {
    return [
      ...preferences.includeKeywords.map((keyword) => ({
        scope: 'include' as const,
        keyword,
      })),
      ...preferences.excludeKeywords.map((keyword) => ({
        scope: 'exclude' as const,
        keyword,
      })),
    ];
  }

  private getRuleSelectionValues(records: RuleSelectionRecord[], scope: JobRuleScope): string[] {
    return records
      .filter((record) => record.scope === scope)
      .map(({ ruleId }) => ruleId);
  }

  private getAdditionalKeywordValues(records: AdditionalKeywordRecord[], scope: JobRuleScope): string[] {
    return records
      .filter((record) => record.scope === scope)
      .map(({ keyword }) => keyword);
  }

  private createPreferencesWithAdditionalKeyword(
    preferences: ScannerPreferences,
    scope: JobRuleScope,
    keyword: string,
  ): ScannerPreferences {
    if (scope === 'include') {
      return {
        ...preferences,
        includeKeywords: this.addUniqueValue(preferences.includeKeywords, keyword),
      };
    }

    return {
      ...preferences,
      excludeKeywords: this.addUniqueValue(preferences.excludeKeywords, keyword),
    };
  }

  private addUniqueValue(values: string[], value: string): string[] {
    if (values.includes(value)) return values;

    return [...values, value];
  }

  private hasDatabasePreferences(): boolean {
    return Object.values(this.files).some((filePath) => fs.existsSync(filePath));
  }

  private readJsonLines<T>(filePath: string): T[] {
    if (!fs.existsSync(filePath)) return [];

    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return [];

    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T);
  }

  private writeJsonLines(filePath: string, records: object[]): void {
    const content = records
      .map((record) => JSON.stringify(record))
      .join('\n');

    fs.writeFileSync(filePath, content ? `${content}\n` : '', 'utf-8');
  }

  private readJson<T>(filePath: string, defaultValue: T): T {
    if (!fs.existsSync(filePath)) return defaultValue;

    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return defaultValue;

    return JSON.parse(content) as T;
  }

  private writeJson(filePath: string, value: object): void {
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  }

  private mergePreferences(preferences: Partial<ScannerPreferences>): ScannerPreferences {
    const definedPreferences = Object.fromEntries(
      Object.entries(preferences).filter(([, value]) => value !== undefined),
    ) as Partial<ScannerPreferences>;

    return {
      ...defaultScannerPreferences,
      ...definedPreferences,
      filters: {
        ...defaultScannerPreferences.filters,
        ...definedPreferences.filters,
      },
    };
  }

  private get files(): ScannerPreferencesFiles {
    return {
      searchQueries: path.join(this.directoryPath, 'search-queries.jsonl'),
      locations: path.join(this.directoryPath, 'locations.jsonl'),
      languages: path.join(this.directoryPath, 'languages.jsonl'),
      restrictedLocations: path.join(this.directoryPath, 'restricted-locations.jsonl'),
      ruleSelections: path.join(this.directoryPath, 'rule-selections.jsonl'),
      additionalKeywords: path.join(this.directoryPath, 'additional-keywords.jsonl'),
      filters: path.join(this.directoryPath, 'search-filters.json'),
      contentSearch: path.join(this.directoryPath, 'content-search.json'),
      executionOptions: path.join(this.directoryPath, 'execution-options.json'),
    };
  }

}
