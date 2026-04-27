export type UndeterminedQueueDecision = 'pending' | 'dismissed' | 'kept';

export type UndeterminedQueueEntry = {
  id: string;
  title: string;
  location: string;
  link: string;
  decision: UndeterminedQueueDecision;
};
