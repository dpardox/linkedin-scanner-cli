export type JobDetailsFieldName = 'title' | 'location' | 'description';

export type JobDetailsFieldSelectorConfig = {
  required: boolean;
  selectors: string[];
};

export type JobDetailsFieldSnapshot = {
  value: string;
  selector: string | null;
};

export type JobDetailsSnapshot = {
  url: string;
  fields: Record<JobDetailsFieldName, JobDetailsFieldSnapshot>;
};

// TODO (dpardo): Move LinkedIn selector catalogs to versioned fixtures so DOM changes can be updated without editing page logic.
export const jobDetailsFieldSelectors: Record<JobDetailsFieldName, JobDetailsFieldSelectorConfig> = {
  title: {
    required: true,
    selectors: [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'main h1',
    ],
  },
  location: {
    required: false,
    selectors: [
      '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text',
      '.job-details-jobs-unified-top-card__tertiary-description-container',
      '.job-details-jobs-unified-top-card__primary-description-container',
      '.jobs-unified-top-card__primary-description',
    ],
  },
  description: {
    required: true,
    selectors: [
      '.jobs-description__container .jobs-box__html-content',
      '.jobs-description-content__text',
      '.jobs-box__html-content',
    ],
  },
};
