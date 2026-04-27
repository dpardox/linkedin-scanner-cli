import { InteractionPort } from '@ports/interaction.port';
import { ExecutionOptions } from '@shared/types/execution-options.type';
import { ManualReviewEntry } from '@shared/types/manual-review-entry.type';

export class NullInteractionAdapter implements InteractionPort {

  public async selectExecutionOptions(defaultOptions: ExecutionOptions): Promise<ExecutionOptions> {
    return defaultOptions;
  }

  public startManualReview(_review: ManualReviewEntry): void {
    return;
  }

  public finishManualReview(_jobId: string): void {
    return;
  }

}
