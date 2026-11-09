// Row types. Field names match the database columns 1:1 so records can be
// synchronised without a mapping layer.

export interface BaseRow {
  id: string;
  updated_at: string; // ISO timestamp, last local change (last-write-wins)
  deleted?: boolean;
  user_id?: string;
  server_updated_at?: string;
}

export interface Profile extends BaseRow {
  display_name: string;
  age: number;
  sex: string;
  height_cm: number;
  start_weight_kg: number;
  goal_weight_kg: number;
  activity_level: string;
  exercise_window: string;
  evening_window: string;
  timezone: string;
  kcal_target_min: number;
  kcal_target_max: number;
  protein_target_min: number;
  protein_target_max: number;
  onboarding_done: boolean;
}

export type ItemKind =
  | "wake"
  | "prep"
  | "workout"
  | "cooldown"
  | "breakfast"
  | "lunch"
  | "dinner"
  | "evening"
  | "winddown"
  | "sleep"
  | "custom";

export interface ScheduleItem extends BaseRow {
  title: string;
  time_local: string;
  kind: ItemKind;
  days: number[] | null;
  reminder_enabled: boolean;
  notify_body: string | null;
  sort_order: number;
  is_custom: boolean;
}

export interface ReminderPreferences extends BaseRow {
  push_enabled: boolean;
  snooze_minutes: number;
}

export interface TaskCompletion extends BaseRow {
  local_date: string;
  item_id: string;
  status: "completed" | "skipped";
}

export interface TrainingCycle extends BaseRow {
  label: string;
  start_date: string;
  end_date: string;
  status: "active" | "completed" | "maintenance";
}

export interface ExercisePreference extends BaseRow {
  variant: "standard" | "easier";
  notes: string | null;
}

export type DayType = "strength" | "conditioning" | "mixed" | "rest";

export interface WorkoutProgress {
  stepIndex: number;
  remainingMs: number | null;
  reps: Record<number, number>;
  skipped: number[];
  variants: Record<string, "standard" | "easier">;
  elapsedMs: number;
}

export interface WorkoutSession extends BaseRow {
  local_date: string;
  cycle_id: string | null;
  program_week: number;
  effective_week: number;
  day_type: DayType;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  fatigue: number | null;
  pain: boolean | null;
  recovery: "good" | "ok" | "poor" | null;
  notes: string | null;
  progress: WorkoutProgress | null;
}

export interface ExerciseResult extends BaseRow {
  session_id: string;
  exercise_key: string;
  variant: "standard" | "easier";
  round: number;
  target_reps: number | null;
  actual_reps: number | null;
  target_seconds: number | null;
  actual_seconds: number | null;
  skipped: boolean;
}

export type FoodCategory = "protein" | "dairy" | "grain" | "fruit" | "vegetable" | "fat" | "seeds" | "liquid" | "other";

export interface Food extends BaseRow {
  name: string;
  unit: string;
  kcal: number;
  protein_g: number;
  category: FoodCategory;
  is_custom: boolean;
}

export type MealSlot = "breakfast" | "lunch" | "dinner";

export interface MealItem {
  food_id: string;
  qty: number;
}

export interface MealTemplate extends BaseRow {
  slot: MealSlot;
  name: string;
  items: MealItem[];
  steps: string[];
  notes: string | null;
}

export interface MealLog extends BaseRow {
  local_date: string;
  slot: MealSlot;
  template_id: string | null;
  items: MealItem[];
  checked: string[];
  kcal: number | null;
  protein_g: number | null;
  status: "planned" | "eaten" | "skipped";
}

export interface WeightLog extends BaseRow {
  local_date: string;
  weight_kg: number;
}

export interface Tables {
  profiles: Profile;
  schedule_items: ScheduleItem;
  reminder_preferences: ReminderPreferences;
  task_completions: TaskCompletion;
  training_cycles: TrainingCycle;
  exercise_preferences: ExercisePreference;
  workout_sessions: WorkoutSession;
  exercise_results: ExerciseResult;
  foods: Food;
  meal_templates: MealTemplate;
  meal_logs: MealLog;
  weight_logs: WeightLog;
}

export type TableName = keyof Tables;

export const TABLES: TableName[] = [
  "profiles",
  "schedule_items",
  "reminder_preferences",
  "task_completions",
  "training_cycles",
  "exercise_preferences",
  "workout_sessions",
  "exercise_results",
  "foods",
  "meal_templates",
  "meal_logs",
  "weight_logs",
];

export type DataState = { [K in TableName]: Record<string, Tables[K]> };

export interface SyncMeta {
  dirty: { [K in TableName]?: string[] };
  cursors: { [K in TableName]?: string };
  lastSyncAt: string | null;
  lastSyncError: string | null;
  userId: string | null;
}

export interface AppState {
  version: number;
  data: DataState;
  sync: SyncMeta;
}
