export type RecurrenceFreq = 'none' | 'daily' | 'weekly' | 'monthly';
export type Priority = 'low' | 'medium' | 'high';
export type ItemType = 'task' | 'study';

/** Advanced recurrence. When present it overrides `recurrence`. weekday: 0=Sun..6=Sat */
export type RecurrenceRule =
  | { kind: 'everyNDays'; n: number }
  | { kind: 'weekdays'; days: number[] }
  | { kind: 'lastWeekdayOfMonth'; weekday: number };

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskLink {
  id: string;
  label?: string;
  url: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;
  categoryId?: string;
  /** Additional free-form tags (multi-label). */
  tags?: string[];
  /** Scheduled / due date in 'yyyy-MM-dd' */
  date: string;
  /** Optional start date 'yyyy-MM-dd' (when work can begin). */
  startDate?: string;
  /** True when the task has no specific time (all-day). */
  allDay?: boolean;
  /** Optional time 'HH:mm' */
  time?: string;
  /** Estimated effort in minutes (for planning). */
  estimateMinutes?: number;
  /** Reminder datetimes 'yyyy-MM-ddTHH:mm' (local). Multiple allowed. */
  reminders?: string[];
  priority: Priority;
  recurrence: RecurrenceFreq;
  /** Advanced recurrence; overrides `recurrence` when set. */
  recurrenceRule?: RecurrenceRule;
  /** Flagged as important (To Do star) */
  important?: boolean;
  /** Checklist of subtasks. */
  subtasks?: Subtask[];
  /** Attached links / references. */
  links?: TaskLink[];
  /** Manual sort position (lower = higher). */
  order?: number;
  /** Occurrence dates ('yyyy-MM-dd') that have been completed */
  completedDates: string[];
  /** Occurrence dates ('yyyy-MM-dd') that have been explicitly skipped. */
  skippedDates?: string[];
  /** Wall-clock time the user marked each occurrence done, 'HH:mm' keyed by dateKey. */
  completedTimes?: Record<string, string>;
  /**
   * Actual calendar day ('yyyy-MM-dd') the user clicked complete, keyed by the
   * scheduled-occurrence dateKey. Set on completion, cleared on undo. Used by
   * the calendar's "completed date" view; falls back to the scheduled key when
   * missing (e.g. data created before this field was tracked).
   */
  completedOn?: Record<string, string>;
  createdAt: string;
  type: ItemType;
  /** Linked learning goal (for study sessions) */
  goalId?: string;
}

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
}

export type ResourceKind = 'course' | 'book' | 'video' | 'article' | 'link';

/** A learning resource attached to a goal (course, book, link, …). */
export interface GoalResource {
  id: string;
  kind: ResourceKind;
  title: string;
  url?: string;
  /** Marked as finished/consumed. */
  done?: boolean;
}

/** Spaced-repetition review state for a goal. */
export interface SpacedRepetition {
  enabled: boolean;
  /** Index into the interval ladder (0 = first review). */
  stage: number;
  /** Last review date 'yyyy-MM-dd'. */
  lastReviewed?: string;
  /** Next scheduled review date 'yyyy-MM-dd'. */
  nextReview?: string;
}

/** A logged focus/study session (e.g. from the Pomodoro timer). */
export interface StudySession {
  id: string;
  goalId?: string;
  taskId?: string;
  /** Day the session happened, 'yyyy-MM-dd'. */
  date: string;
  minutes: number;
  note?: string;
  createdAt: string;
}

export interface LearningGoal {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  targetDate?: string;
  milestones: Milestone[];
  /** Linked learning resources (courses, books, links). */
  resources?: GoalResource[];
  /** Spaced-repetition review schedule. */
  sr?: SpacedRepetition;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  /** Day the item was completed, 'yyyy-MM-dd' */
  date: string;
  text: string;
  createdAt: string;
}
