import { TimePostedRange } from '@enums/time-posted-range.enum';
import { Location } from '@enums/location.enum';
import { WorkType } from '@enums/work-type.enum';
import { JobSearchConfig } from '@shared/types/job-search-config.type';

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
       * Time range in which the job was posted.
       *
       * Use a TimePostedRange enum:
       * Example: TimePostedRange.day
       * Example: TimePostedRange.week
       * Example: TimePostedRange.month
       *
       * Or use a raw LinkedIn format:
       * Example: 'r604800' (jobs posted within the last 7 days)
       */
      timePostedRange: TimePostedRange.day,

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

    keywords: {
      /**
       * Required keywords that must appear in the job description.
       *
       * If none of these keywords are present, the job will be excluded.
       *
       * Example: ['angular']
       */
      strictInclude: ['angular'],

      /** Not implemented yet */
      include: [],
      exclude: [],

      /**
       * Forbidden keywords — if any of these are found in the job description,
       * the job will be discarded.
       *
       * Example: ['strong proficiency in react']
       */
      strictExclude: [],
    },
  },
  /**
   * You can define multiple job search configurations
   * by duplicating the object above and customizing its values.
   *
   * Each configuration will be executed independently.
   */
];
