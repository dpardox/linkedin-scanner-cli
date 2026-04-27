import { ExecutionOptions } from '@shared/types/execution-options.type';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';

export interface InteractionPort {
  selectExecutionOptions(defaultOptions: ExecutionOptions): Promise<ExecutionOptions>;
  startManualReview(review: ManualReviewEntry): void;
  finishManualReview(jobId: string): void;
}
