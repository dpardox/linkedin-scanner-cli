import { ExecutionOptions } from '@shared/types/execution-options.type';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';
import { ScannerPreferences } from '@shared/types/scanner-preferences.type';

export interface InteractionPort {
  selectScannerPreferences(defaultPreferences: ScannerPreferences): Promise<ScannerPreferences>;
  selectExecutionOptions(defaultOptions: ExecutionOptions): Promise<ExecutionOptions>;
  startManualReview(review: ManualReviewEntry): void;
  finishManualReview(jobId: string): void;
}
