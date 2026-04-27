import fs from 'fs';
import path from 'path';
import { ScannerPreferencesPath } from '@enums/scanner-preferences-path.enum';
import { ScannerPreferences } from '@shared/types/scanner-preferences.type';
import { defaultScannerPreferences } from './default-scanner-preferences';

export class ScannerPreferencesFileRepository {

  private readonly filePath: string;

  constructor(filePath: string = ScannerPreferencesPath.file) {
    this.filePath = path.resolve(process.cwd(), filePath);
  }

  public hasPreferences(): boolean {
    return fs.existsSync(this.filePath);
  }

  public read(): ScannerPreferences {
    if (!this.hasPreferences()) {
      return defaultScannerPreferences;
    }

    const parsedPreferences = JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as Partial<ScannerPreferences>;
    return this.mergePreferences(parsedPreferences);
  }

  public write(preferences: ScannerPreferences): void {
    const directory = path.dirname(this.filePath);

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    fs.writeFileSync(this.filePath, `${JSON.stringify(preferences, null, 2)}\n`, 'utf-8');
  }

  private mergePreferences(preferences: Partial<ScannerPreferences>): ScannerPreferences {
    return {
      ...defaultScannerPreferences,
      ...preferences,
      filters: {
        ...defaultScannerPreferences.filters,
        ...preferences.filters,
      },
    };
  }

}
