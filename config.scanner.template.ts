import { Location } from '@enums/location.enum';
import { WorkType } from '@enums/work-type.enum';
import { createKeywordsFromPersistedRules } from '@config/rules';
import { Filters } from '@shared/types/filters.type';
import { JobSearchConfig } from '@shared/types/job-search-config.type';

const defaultLanguages = ['eng', 'spa'];

export const defaultJobSearchFilters: Filters = {
};

export const jobSearchConfigs: JobSearchConfig[] = [
  {
    /**
     * Query used to search for jobs.
     *
     * Use double quotes for an exact match:
     * Example: '"angular"'
     *
     * Use a single term for a broader search:
     * Example: 'angular'
     */
    query: 'angular',

    /**
     * Location where to search for jobs.
     *
     * Use a predefined Location enum:
     * Example: [ Location.colombia, Location.argentina ]
     *
     * Or provide a LinkedIn location ID:
     * Example: 100876405
     */
    locations: [ Location.colombia ],

    /**
     * Locations to exclude from the search.
     *
     * Provide a list of strings that match unwanted locations:
     * Example: ['Colombia']
     */
    restrictedLocations: [],

    filters: {
      /**
       * The scanner automatically runs each search for:
       * last day -> last week -> last month.
       *
       * Do not configure timePostedRange here.
       */

      /**
       * Type of work arrangement.
       *
       * Use a WorkType enum:
       * Example: WorkType.remote
       * Example: WorkType.hybrid
       * Example: WorkType.onSite
       */
      workType: WorkType.remote,

      /**
       * Whether to include only jobs with the "Easy Apply" option.
       *
       * Example: true
       */
      easyApply: true,
    },

    keywords: createKeywordsFromPersistedRules({
      /**
       * Persisted rules live in rules/catalog.jsonl by default.
       */
      includeRuleIds: ['angular'],
      excludeRuleIds: ['english', 'dotnet', 'strict-exclude-additional'],

      /**
       * You can still add one-off keywords directly when needed.
       *
       * Example: ['frontend']
       */
      includeKeywords: [],

      /**
       * Example: ['strong proficiency in react']
       */
      excludeKeywords: [],
    }),

    /**
     * ISO 639-3 language codes detected by franc.
     * Example: ['eng', 'spa']
     */
    languages: [...defaultLanguages],
  },
  /**
   * You can define multiple job search configurations
   * by duplicating the object above and customizing its values.
   *
   * Each configuration will be executed independently.
   */
];

/**
 * Query used to populate the final LinkedIn posts search window.
 */
export const contentSearchQuery = '"desarrollador angular"';
