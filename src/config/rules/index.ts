import { JobRuleFileRepository, defaultPersistedJobRulesDirectory } from './job-rule-file.repository';
import { PersistedJobRuleManager } from './persisted-job-rule.manager';
import { JobRuleScope, PersistedJobRule, PersistedJobRuleSelection } from './persisted-job-rule.type';

let persistedJobRuleManager: PersistedJobRuleManager | undefined;

export function getPersistedJobRuleManager(): PersistedJobRuleManager {
  persistedJobRuleManager ??= new PersistedJobRuleManager();
  return persistedJobRuleManager;
}

export function createKeywordsFromPersistedRules(selection: PersistedJobRuleSelection = {}) {
  return getPersistedJobRuleManager().createKeywords(selection);
}

export function listPersistedJobRules(): PersistedJobRule[] {
  return getPersistedJobRuleManager().listRules();
}

export function getFlattenedPersistedJobRuleTerms(ruleIds: string[] = [], additionalTerms: string[] = []): string[] {
  return getPersistedJobRuleManager().getFlattenedTerms(ruleIds, additionalTerms);
}

export function upsertPersistedJobRule(rule: PersistedJobRule): PersistedJobRule {
  return getPersistedJobRuleManager().upsertRule(rule);
}

export function deletePersistedJobRule(ruleId: string): PersistedJobRule | null {
  return getPersistedJobRuleManager().deleteRule(ruleId);
}

export { defaultPersistedJobRulesDirectory, JobRuleFileRepository, PersistedJobRuleManager };
export type { JobRuleScope, PersistedJobRule, PersistedJobRuleSelection };
