import fs from 'fs';
import path from 'path';
import { defaultPersistedJobRules } from './default-persisted-job-rules';
import { JobRuleScope, PersistedJobRule, PersistedJobRuleKind } from './persisted-job-rule.type';

type JobRuleFileRepositoryOptions = {
  directoryPath?: string;
  legacyFilePath?: string;
  legacyFilePaths?: string[];
  seedRules?: PersistedJobRule[];
};

type RawPersistedJobRule = Omit<PersistedJobRule, 'kind'> & {
  kind: PersistedJobRuleKind | 'skill';
};

const jobRuleScopes: JobRuleScope[] = ['include', 'exclude'];
const legacyCatalogFileName = 'catalog.jsonl';
const ruleFileExtension = '.json';

export const defaultPersistedJobRulesDirectory = path.resolve(process.cwd(), 'keywords');
export const legacyPersistedJobRulesPaths = [
  path.resolve(process.cwd(), 'skills/catalog.jsonl'),
  path.resolve(process.cwd(), 'rules/catalog.jsonl'),
];

export class JobRuleFileRepository {

  private readonly directoryPath: string;
  private readonly legacyFilePaths: string[];
  private readonly seedRules: PersistedJobRule[];

  constructor(options: JobRuleFileRepositoryOptions = {}) {
    this.directoryPath = path.resolve(options.directoryPath ?? defaultPersistedJobRulesDirectory);
    this.legacyFilePaths = this.resolveLegacyFilePaths(options);
    this.seedRules = options.seedRules ?? defaultPersistedJobRules;
    this.connect();
  }

  public get path(): string {
    return this.directoryPath;
  }

  public list(): PersistedJobRule[] {
    return this.read();
  }

  public findByIds(ruleIds: string[]): PersistedJobRule[] {
    if (!ruleIds.length) return [];

    const rulesById = new Map(this.read().map((rule) => [rule.id, rule]));

    return ruleIds.flatMap((ruleId) => {
      const rule = rulesById.get(ruleId);
      return rule ? [rule] : [];
    });
  }

  public upsert(rule: PersistedJobRule): PersistedJobRule {
    const normalizedRule = this.normalizeRule(rule);
    const rules = this.read();
    const ruleIndex = rules.findIndex(({ id }) => id === normalizedRule.id);

    if (ruleIndex === -1) {
      this.write([...rules, normalizedRule]);
      return normalizedRule;
    }

    this.write(rules.map((currentRule) => {
      if (currentRule.id !== normalizedRule.id) return currentRule;

      return normalizedRule;
    }));
    return normalizedRule;
  }

  public delete(ruleId: string): PersistedJobRule | null {
    const rules = this.read();
    const ruleIndex = rules.findIndex(({ id }) => id === ruleId);

    if (ruleIndex === -1) return null;

    const deletedRule = rules[ruleIndex];
    this.write(rules.filter(({ id }) => id !== ruleId));
    return deletedRule;
  }

  private connect(): void {
    if (!fs.existsSync(this.directoryPath)) {
      fs.mkdirSync(this.directoryPath, { recursive: true });
    }

    if (this.hasRuleFiles()) {
      return;
    }

    this.write(this.getInitialRules());
  }

  private read(): PersistedJobRule[] {
    const ruleFilePaths = this.listRuleFilePaths();
    if (!ruleFilePaths.length) return [];

    return ruleFilePaths.flatMap((filePath) => this.readFile(filePath));
  }

  private write(rules: PersistedJobRule[]): void {
    const normalizedRules = rules.map((rule) => this.normalizeRule(rule));
    this.deleteRuleFiles();

    normalizedRules.forEach((rule) => {
      fs.writeFileSync(this.createRuleFilePath(rule), `${JSON.stringify(rule, null, 2)}\n`, 'utf-8');
    });
  }

  private getInitialRules(): PersistedJobRule[] {
    if (this.hasScopedRuleFiles()) {
      return this.readScopedRuleFiles();
    }

    if (fs.existsSync(this.legacyCatalogFilePath)) {
      return this.readFile(this.legacyCatalogFilePath);
    }

    const legacyFilePath = this.legacyFilePaths.find((filePath) => fs.existsSync(filePath));
    if (!legacyFilePath) {
      return this.seedRules;
    }

    return this.readFile(legacyFilePath);
  }

  private readFile(filePath: string): PersistedJobRule[] {
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (!content) return [];

    if (filePath.endsWith('.json')) {
      return this.parseJson(content);
    }

    return this.parseJsonLines(content);
  }

  private hasScopedRuleFiles(): boolean {
    return jobRuleScopes.some((scope) => fs.existsSync(this.createScopeFilePath(scope)));
  }

  private readScopedRuleFiles(): PersistedJobRule[] {
    return jobRuleScopes.flatMap((scope) => {
      const filePath = this.createScopeFilePath(scope);
      if (!fs.existsSync(filePath)) return [];

      return this.readFile(filePath);
    });
  }

  private createScopeFilePath(scope: JobRuleScope): string {
    return path.join(this.directoryPath, `${scope}.jsonl`);
  }

  private hasRuleFiles(): boolean {
    return this.listRuleFilePaths().length > 0;
  }

  private listRuleFilePaths(): string[] {
    return fs.readdirSync(this.directoryPath)
      .filter((fileName) => fileName.endsWith(ruleFileExtension))
      .sort()
      .map((fileName) => path.join(this.directoryPath, fileName));
  }

  private deleteRuleFiles(): void {
    this.listRuleFilePaths().forEach((filePath) => {
      fs.rmSync(filePath, { force: true });
    });
  }

  private createRuleFilePath(rule: PersistedJobRule): string {
    return path.join(this.directoryPath, `${this.createRuleFileName(rule.id)}${ruleFileExtension}`);
  }

  private createRuleFileName(ruleId: string): string {
    return ruleId.replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  private get legacyCatalogFilePath(): string {
    return path.join(this.directoryPath, legacyCatalogFileName);
  }

  private resolveLegacyFilePaths(options: JobRuleFileRepositoryOptions): string[] {
    if (options.legacyFilePaths) {
      return options.legacyFilePaths.map((filePath) => path.resolve(filePath));
    }

    if (options.legacyFilePath) {
      return [path.resolve(options.legacyFilePath)];
    }

    if (!options.directoryPath) {
      return legacyPersistedJobRulesPaths;
    }

    return [];
  }

  private parseJson(content: string): PersistedJobRule[] {
    const parsedContent = JSON.parse(content) as RawPersistedJobRule | RawPersistedJobRule[];
    const parsedRules = Array.isArray(parsedContent) ? parsedContent : [parsedContent];
    return parsedRules.map((rule) => this.normalizeRule(rule));
  }

  private parseJsonLines(content: string): PersistedJobRule[] {
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as RawPersistedJobRule)
      .map((rule) => this.normalizeRule(rule));
  }

  private normalizeRule(rule: RawPersistedJobRule): PersistedJobRule {
    const id = rule.id.trim();
    const name = rule.name.trim();
    const terms = this.normalizeTerms(rule.terms);

    if (!id) {
      throw new Error(`Rule ID is required in "${this.directoryPath}".`);
    }

    if (!name) {
      throw new Error(`Rule name is required for "${id}" in "${this.directoryPath}".`);
    }

    if (!terms.length) {
      throw new Error(`Rule "${id}" must contain at least one term in "${this.directoryPath}".`);
    }

    return {
      id,
      name,
      kind: this.normalizeRuleKind(rule.kind),
      terms,
    };
  }

  private normalizeRuleKind(kind: PersistedJobRuleKind | 'skill'): PersistedJobRuleKind {
    if (kind === 'skill') return 'keyword';

    return kind;
  }

  private normalizeTerms(terms: string[]): string[] {
    return Array.from(
      new Set(
        terms
          .map((term) => term.trim())
          .filter(Boolean),
      ),
    );
  }

}
