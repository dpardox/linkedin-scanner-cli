import { ExecutionOptions } from '@shared/types/execution-options.type';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';
import { ScannerPreferences } from '@shared/types/scanner-preferences.type';

export type InteractionActionLabels = {
  runningText: string;
  successText: string;
  failureText: string;
};

export interface InteractionPort {
  selectScannerPreferences(defaultPreferences: ScannerPreferences): Promise<ScannerPreferences>;
  selectExecutionOptions(defaultOptions: ExecutionOptions): Promise<ExecutionOptions>;
  runAction<T>(labels: InteractionActionLabels, action: () => Promise<T> | T): Promise<T>;
  startManualReview(review: ManualReviewEntry): void;
  finishManualReview(jobId: string): void;
  close?(): void;
}
