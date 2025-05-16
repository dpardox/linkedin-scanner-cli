import { TimePostedRange } from '@enums/time-posted-range.enum';
import { WorkType } from '@enums/work-type.enum';

export interface Filters {
  timePostedRange: TimePostedRange;
  workType: WorkType;
  easyApply: boolean;
}
