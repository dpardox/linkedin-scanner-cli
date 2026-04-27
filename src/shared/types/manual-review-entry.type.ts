import { JobRuleScope } from '@config/rules';

export type ManualReviewEntry = {
  id: string;
  title: string;
  link: string;
  location: string;
  emails: string[];
  language: string;
  criteria: string[];
  classification: 'include' | 'unknown';
  defaultRuleScope: JobRuleScope;
};
