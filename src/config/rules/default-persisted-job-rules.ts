import fs from 'fs';
import path from 'path';
import { PersistedJobRule } from './persisted-job-rule.type';

const defaultPersistedJobRulesDirectoryPath = path.resolve(process.cwd(), 'keywords');
const persistedJobRuleFileExtension = '.json';

export const additionalExcludeKeywordRuleIds = ['java', 'python', 'golang', 'react', 'aws'];
export const defaultPersistedJobRules: PersistedJobRule[] = readDefaultPersistedJobRules();

function readDefaultPersistedJobRules(): PersistedJobRule[] {
  return fs.readdirSync(defaultPersistedJobRulesDirectoryPath)
    .filter((fileName) => fileName.endsWith(persistedJobRuleFileExtension))
    .sort()
    .map((fileName) => readDefaultPersistedJobRule(path.join(defaultPersistedJobRulesDirectoryPath, fileName)));
}

function readDefaultPersistedJobRule(filePath: string): PersistedJobRule {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PersistedJobRule;
}
