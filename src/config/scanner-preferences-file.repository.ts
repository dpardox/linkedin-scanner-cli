import fs from 'fs';
import path from 'path';
import { ScannerPreferencesPath } from '@enums/scanner-preferences-path.enum';
import { LocationKey, ScannerPreferences } from '@shared/types/scanner-preferences.type';
import { normalizeJobSearchQueries } from '@utils/job-search-query.util';
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

type SearchOptionsRecord = {
  strictSearchMode: boolean;
};

type ExecutionOptionsRecord = {
  showUnknownJobs: boolean;
};

type ScannerPreferencesFiles = {
  searchQueries: string;
  locations: string;
  languages: string;
  ruleSelections: string;
  additionalKeywords: string;
  filters: string;
  contentSearch: string;
  searchOptions: string;
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

    const searchQueryRecords = normalizeJobSearchQueries(preferences.searchQueries).map((query) => ({ query }));

    this.writeJsonLines(this.files.searchQueries, searchQueryRecords);
    this.writeJsonLines(this.files.locations, preferences.locationKeys.map((key) => ({ key })));
    this.writeJsonLines(this.files.languages, preferences.languages.map((code) => ({ code })));
    this.writeJsonLines(this.files.ruleSelections, this.createRuleSelectionRecords(preferences));
    this.writeJsonLines(this.files.additionalKeywords, this.createAdditionalKeywordRecords(preferences));
    this.writeJson(this.files.filters, preferences.filters);
    this.writeJson(this.files.contentSearch, { query: preferences.contentSearchQuery });
    this.writeJson(this.files.searchOptions, { strictSearchMode: preferences.strictSearchMode });
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
    const searchOptions = this.readJson<Partial<SearchOptionsRecord>>(this.files.searchOptions, {});
    const executionOptions = this.readJson<Partial<ExecutionOptionsRecord>>(this.files.executionOptions, {});
    const searchQueries = normalizeJobSearchQueries(
      this.readJsonLines<SearchQueryRecord>(this.files.searchQueries).map(({ query }) => query),
    );

    return this.mergePreferences({
      searchQueries,
      strictSearchMode: searchOptions.strictSearchMode,
      locationKeys: this.readJsonLines<LocationRecord>(this.files.locations).map(({ key }) => key),
      languages: this.readJsonLines<LanguageRecord>(this.files.languages).map(({ code }) => code),
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
    const preferences = this.mergePreferences(parsedPreferences);

    return {
      ...preferences,
      searchQueries: normalizeJobSearchQueries(preferences.searchQueries),
    };
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
    return {
      searchQueries: preferences.searchQueries ?? defaultScannerPreferences.searchQueries,
      strictSearchMode: preferences.strictSearchMode ?? defaultScannerPreferences.strictSearchMode,
      locationKeys: preferences.locationKeys ?? defaultScannerPreferences.locationKeys,
      languages: preferences.languages ?? defaultScannerPreferences.languages,
      filters: {
        ...defaultScannerPreferences.filters,
        ...preferences.filters,
      },
      includeRuleIds: preferences.includeRuleIds ?? defaultScannerPreferences.includeRuleIds,
      excludeRuleIds: preferences.excludeRuleIds ?? defaultScannerPreferences.excludeRuleIds,
      includeKeywords: preferences.includeKeywords ?? defaultScannerPreferences.includeKeywords,
      excludeKeywords: preferences.excludeKeywords ?? defaultScannerPreferences.excludeKeywords,
      contentSearchQuery: preferences.contentSearchQuery ?? defaultScannerPreferences.contentSearchQuery,
      showUnknownJobs: preferences.showUnknownJobs ?? defaultScannerPreferences.showUnknownJobs,
    };
  }

  private get files(): ScannerPreferencesFiles {
    return {
      searchQueries: path.join(this.directoryPath, 'search-queries.jsonl'),
      locations: path.join(this.directoryPath, 'locations.jsonl'),
      languages: path.join(this.directoryPath, 'languages.jsonl'),
      ruleSelections: path.join(this.directoryPath, 'rule-selections.jsonl'),
      additionalKeywords: path.join(this.directoryPath, 'additional-keywords.jsonl'),
      filters: path.join(this.directoryPath, 'search-filters.json'),
      contentSearch: path.join(this.directoryPath, 'content-search.json'),
      searchOptions: path.join(this.directoryPath, 'search-options.json'),
      executionOptions: path.join(this.directoryPath, 'execution-options.json'),
    };
  }

}
