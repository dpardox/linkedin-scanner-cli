import { InteractionActionLabels, InteractionPort } from '@ports/interaction.port';
import { ExecutionOptions } from '@shared/types/execution-options.type';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';
import { ScannerPreferences } from '@shared/types/scanner-preferences.type';

export class NullInteractionAdapter implements InteractionPort {

  public async selectScannerPreferences(defaultPreferences: ScannerPreferences): Promise<ScannerPreferences> {
    return defaultPreferences;
  }

  public async selectExecutionOptions(defaultOptions: ExecutionOptions): Promise<ExecutionOptions> {
    return defaultOptions;
  }

  public async runAction<T>(_labels: InteractionActionLabels, action: () => Promise<T> | T): Promise<T> {
    return await action();
  }

  public startManualReview(_review: ManualReviewEntry): void {
    return;
  }

  public finishManualReview(_jobId: string): void {
    return;
  }

}
