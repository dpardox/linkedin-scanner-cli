import { Keywords } from '@shared/types/keywords';
import { JobRuleFileRepository } from './job-rule-file.repository';
import { PersistedJobRule, PersistedJobRuleSelection } from './persisted-job-rule.type';

export class PersistedJobRuleManager {

  constructor(
    private readonly repository: JobRuleFileRepository = new JobRuleFileRepository(),
  ) {}

  public listRules(): PersistedJobRule[] {
    return this.repository.list();
  }

  public upsertRule(rule: PersistedJobRule): PersistedJobRule {
    return this.repository.upsert(rule);
  }

  public deleteRule(ruleId: string): PersistedJobRule | null {
    return this.repository.delete(ruleId);
  }

  public getFlattenedTerms(ruleIds: string[] = [], additionalTerms: string[] = []): string[] {
    const selectedTerms = this.repository.findByIds(ruleIds).map(({ terms }) => terms);
    return this.mergeTerms(...selectedTerms, additionalTerms);
  }

  public createKeywords({
    includeRuleIds = [],
    excludeRuleIds = [],
    includeKeywords = [],
    excludeKeywords = [],
  }: PersistedJobRuleSelection = {}): Keywords {
    return {
      include: this.getFlattenedTerms(includeRuleIds, includeKeywords),
      exclude: this.getFlattenedTerms(excludeRuleIds, excludeKeywords),
    };
  }

  private mergeTerms(...groups: Array<ReadonlyArray<string> | undefined>): string[] {
    return Array.from(
      new Set(
        groups
          .flatMap((group) => group ?? [])
          .filter((term): term is string => Boolean(term?.trim())),
      ),
    );
  }

}
