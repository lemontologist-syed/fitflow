// Default data seeded on first launch. Seed rows carry an old timestamp so
// that anything already saved on the server (newer) always wins a sync.
import type {
  Food,
  MealTemplate,
  Profile,
  ReminderPreferences,
  ScheduleItem,
  TrainingCycle,
} from "./types";

export const SEED_TIME = "2026-01-01T00:00:00.000Z";
export const DEFAULT_TZ = "Asia/Seoul";
export const PROGRAM_START = "2026-11-09";
export const PROGRAM_END = "2026-12-05";

export const defaultProfile = (): Profile => ({
  id: "me",
  display_name: "",
  age: 29,
  sex: "male",
  height_cm: 175,
  start_weight_kg: 80,
  goal_weight_kg: 75,
  activity_level: "Mostly sedentary (research/office work), good athletic stamina",
  exercise_window: "07:00-09:00",
  evening_window: "21:00-23:00",
  timezone: DEFAULT_TZ,
  kcal_target_min: 1800,
  kcal_target_max: 2000,
  protein_target_min: 110,
  protein_target_max: 130,
  onboarding_done: false,
  updated_at: SEED_TIME,
});

const WORKOUT_DAYS = [1, 2, 3, 4, 5, 6]; // Monday-Saturday (Sunday = rest)

type SeedItem = Omit<ScheduleItem, "updated_at" | "is_custom" | "sort_order" | "days"> & { days?: number[] | null };

const seedItems: SeedItem[] = [
  { id: "wake", title: "Wake up", time_local: "07:00", kind: "wake", reminder_enabled: true,
    notify_body: "Good morning! Time to wake up and drink a glass of water." },
  { id: "prep", title: "Prepare for exercise, drink water", time_local: "07:15", kind: "prep", reminder_enabled: true,
    days: WORKOUT_DAYS, notify_body: "Workout in 5 minutes: change, drink water, clear some floor space." },
  { id: "workout", title: "Start workout", time_local: "07:20", kind: "workout", reminder_enabled: true,
    days: WORKOUT_DAYS, notify_body: "Time to start today's workout. Open FitFlow to follow the timer." },
  { id: "cooldown", title: "Finish workout and cooldown", time_local: "08:15", kind: "cooldown", reminder_enabled: true,
    days: WORKOUT_DAYS, notify_body: "Cool down and log your workout in FitFlow." },
  { id: "breakfast", title: "Breakfast", time_local: "09:00", kind: "breakfast", reminder_enabled: true,
    notify_body: "Breakfast time: eggs, Greek yogurt and fruit are planned." },
  { id: "lunch", title: "Lunch: overnight oats", time_local: "12:30", kind: "lunch", reminder_enabled: true,
    notify_body: "Lunch: your overnight oats are ready. Add banana, orange and sesame, plus 2 boiled eggs." },
  { id: "dinner", title: "Dinner", time_local: "19:30", kind: "dinner", reminder_enabled: true,
    notify_body: "Dinner time. Log what you eat in FitFlow." },
  { id: "evening", title: "Optional walk or stretching", time_local: "21:00", kind: "evening", reminder_enabled: true,
    notify_body: "Optional: a short walk or 10 minutes of stretching." },
  { id: "winddown", title: "Prepare for sleep", time_local: "22:30", kind: "winddown", reminder_enabled: true,
    notify_body: "Wind down: dim the lights, put the screen away, and prepare tomorrow's overnight oats." },
  { id: "sleep", title: "Sleep", time_local: "23:00", kind: "sleep", reminder_enabled: true,
    notify_body: "Bedtime. Aim for 8 hours before the 7:00 AM wake-up." },
];

export const defaultSchedule = (): ScheduleItem[] =>
  seedItems.map((s, i) => ({
    ...s,
    days: s.days ?? null,
    sort_order: i * 10,
    is_custom: false,
    updated_at: SEED_TIME,
  }));

export const defaultReminderPrefs = (): ReminderPreferences => ({
  id: "me",
  push_enabled: false,
  snooze_minutes: 10,
  updated_at: SEED_TIME,
});

export const defaultCycle = (): TrainingCycle => ({
  id: "cycle-1",
  label: "Cycle 1",
  start_date: PROGRAM_START,
  end_date: PROGRAM_END,
  status: "active",
  updated_at: SEED_TIME,
});

// Nutrition values are typical label/database estimates; brands differ.
type SeedFood = Omit<Food, "updated_at" | "is_custom">;
const seedFoods: SeedFood[] = [
  { id: "egg", name: "Egg, boiled (large)", unit: "1 egg", kcal: 78, protein_g: 6.3, category: "protein" },
  { id: "greek-yogurt", name: "Greek yogurt, plain (2% fat)", unit: "100 g", kcal: 73, protein_g: 10, category: "dairy" },
  { id: "greek-yogurt-0", name: "Greek yogurt, plain (0% fat)", unit: "100 g", kcal: 59, protein_g: 10.3, category: "dairy" },
  { id: "milk", name: "Milk (whole)", unit: "100 ml", kcal: 61, protein_g: 3.2, category: "liquid" },
  { id: "milk-low", name: "Milk (low-fat)", unit: "100 ml", kcal: 42, protein_g: 3.4, category: "liquid" },
  { id: "water", name: "Water", unit: "100 ml", kcal: 0, protein_g: 0, category: "liquid" },
  { id: "oats", name: "Rolled oats", unit: "100 g", kcal: 379, protein_g: 13.2, category: "grain" },
  { id: "chia", name: "Chia seeds", unit: "100 g", kcal: 486, protein_g: 16.5, category: "seeds" },
  { id: "sesame", name: "Sesame seeds", unit: "100 g", kcal: 573, protein_g: 17.7, category: "seeds" },
  { id: "banana", name: "Banana (medium)", unit: "1 banana", kcal: 105, protein_g: 1.3, category: "fruit" },
  { id: "orange", name: "Orange (medium)", unit: "1 orange", kcal: 62, protein_g: 1.2, category: "fruit" },
  { id: "apple", name: "Apple (medium)", unit: "1 apple", kcal: 95, protein_g: 0.5, category: "fruit" },
  { id: "berries", name: "Mixed berries", unit: "100 g", kcal: 50, protein_g: 0.7, category: "fruit" },
  { id: "cream", name: "Fresh cream", unit: "1 tsp", kcal: 17, protein_g: 0.1, category: "fat" },
  { id: "olive-oil", name: "Olive oil", unit: "1 tsp", kcal: 40, protein_g: 0, category: "fat" },
  { id: "bread", name: "Whole-grain bread", unit: "1 slice", kcal: 100, protein_g: 4.5, category: "grain" },
  { id: "rice", name: "White rice, cooked", unit: "100 g", kcal: 130, protein_g: 2.7, category: "grain" },
  { id: "brown-rice", name: "Brown rice, cooked", unit: "100 g", kcal: 112, protein_g: 2.3, category: "grain" },
  { id: "chicken", name: "Chicken breast, cooked", unit: "100 g", kcal: 165, protein_g: 31, category: "protein" },
  { id: "white-fish", name: "White fish (e.g. pollock), cooked", unit: "100 g", kcal: 105, protein_g: 23, category: "protein" },
  { id: "salmon", name: "Salmon, cooked", unit: "100 g", kcal: 206, protein_g: 22, category: "protein" },
  { id: "mackerel", name: "Mackerel, grilled", unit: "100 g", kcal: 262, protein_g: 24, category: "protein" },
  { id: "tofu", name: "Tofu, firm", unit: "100 g", kcal: 120, protein_g: 13, category: "protein" },
  { id: "lentils", name: "Lentils, cooked", unit: "100 g", kcal: 116, protein_g: 9, category: "protein" },
  { id: "vegetables", name: "Mixed vegetables", unit: "100 g", kcal: 35, protein_g: 2, category: "vegetable" },
  { id: "salad", name: "Leafy salad", unit: "100 g", kcal: 17, protein_g: 1.3, category: "vegetable" },
  { id: "kimchi", name: "Kimchi", unit: "100 g", kcal: 15, protein_g: 1.1, category: "vegetable" },
];

export const defaultFoods = (): Food[] =>
  seedFoods.map((f) => ({ ...f, is_custom: false, updated_at: SEED_TIME }));

const OATS_STEPS = [
  "Put the oats and chia seeds in a jar.",
  "Add the Greek yogurt and the water or milk.",
  "Add the optional cream.",
  "Mix thoroughly.",
  "Cover and refrigerate overnight.",
  "Before lunch, add the banana, orange and sesame seeds.",
  "Eat the two boiled eggs separately.",
];

export const defaultTemplates = (): MealTemplate[] =>
  (
    [
      {
        id: "breakfast-eggs-yogurt",
        slot: "breakfast",
        name: "Eggs, Greek yogurt & fruit",
        items: [
          { food_id: "egg", qty: 3 },
          { food_id: "greek-yogurt", qty: 1.5 },
          { food_id: "banana", qty: 1 },
          { food_id: "bread", qty: 1 },
        ],
        steps: ["Boil the eggs (9–10 minutes), or use eggs boiled the night before.", "Serve the yogurt with sliced fruit.", "Toast the bread if you like."],
        notes: "Protein-rich breakfast.",
      },
      {
        id: "breakfast-yogurt-bowl",
        slot: "breakfast",
        name: "Greek yogurt bowl with oats & berries",
        items: [
          { food_id: "greek-yogurt", qty: 2.5 },
          { food_id: "oats", qty: 0.3 },
          { food_id: "berries", qty: 1 },
          { food_id: "chia", qty: 0.1 },
        ],
        steps: ["Spoon the yogurt into a bowl.", "Top with oats, berries and chia."],
        notes: null,
      },
      {
        id: "breakfast-tofu-scramble",
        slot: "breakfast",
        name: "Tofu & egg scramble with toast",
        items: [
          { food_id: "tofu", qty: 1.5 },
          { food_id: "egg", qty: 2 },
          { food_id: "vegetables", qty: 1 },
          { food_id: "bread", qty: 1 },
          { food_id: "olive-oil", qty: 1 },
        ],
        steps: ["Crumble the tofu into a hot pan with the oil.", "Add the eggs and vegetables and stir until set.", "Serve with toast."],
        notes: null,
      },
      {
        id: "lunch-overnight-oats",
        slot: "lunch",
        name: "High-protein overnight oats",
        items: [
          { food_id: "oats", qty: 0.4 },
          { food_id: "greek-yogurt", qty: 1.7 },
          { food_id: "chia", qty: 0.1 },
          { food_id: "sesame", qty: 0.05 },
          { food_id: "banana", qty: 0.5 },
          { food_id: "orange", qty: 0.5 },
          { food_id: "egg", qty: 2 },
          { food_id: "water", qty: 0.9 },
        ],
        steps: OATS_STEPS,
        notes:
          "One serving. Optional: 1 teaspoon fresh cream (+17 kcal). Use 80–100 ml water or milk; milk adds calories and protein. About 590 kcal with water — an estimate that depends on your yogurt.",
      },
      {
        id: "dinner-chicken-rice",
        slot: "dinner",
        name: "Chicken, rice & vegetables",
        items: [
          { food_id: "chicken", qty: 1.2 },
          { food_id: "rice", qty: 2.5 },
          { food_id: "vegetables", qty: 2 },
          { food_id: "olive-oil", qty: 3 },
          { food_id: "kimchi", qty: 0.5 },
        ],
        steps: ["Pan-fry or grill the chicken.", "Stir-fry the vegetables in the oil.", "Serve with rice and kimchi."],
        notes: null,
      },
      {
        id: "dinner-fish-rice",
        slot: "dinner",
        name: "Fish, rice & vegetables",
        items: [
          { food_id: "white-fish", qty: 1.8 },
          { food_id: "rice", qty: 2 },
          { food_id: "vegetables", qty: 2 },
          { food_id: "olive-oil", qty: 2 },
        ],
        steps: ["Bake, steam or pan-fry the fish.", "Cook the vegetables.", "Serve with rice."],
        notes: null,
      },
      {
        id: "dinner-egg-stirfry",
        slot: "dinner",
        name: "Egg & vegetable stir-fry with rice",
        items: [
          { food_id: "egg", qty: 3 },
          { food_id: "vegetables", qty: 2.5 },
          { food_id: "rice", qty: 2 },
          { food_id: "olive-oil", qty: 2 },
          { food_id: "greek-yogurt", qty: 1 },
        ],
        steps: ["Stir-fry the vegetables.", "Add beaten eggs and scramble.", "Serve over rice; yogurt on the side."],
        notes: null,
      },
      {
        id: "dinner-lentil-curry",
        slot: "dinner",
        name: "Lentil curry with rice & yogurt",
        items: [
          { food_id: "lentils", qty: 2.5 },
          { food_id: "rice", qty: 1.5 },
          { food_id: "vegetables", qty: 1.5 },
          { food_id: "greek-yogurt", qty: 1 },
          { food_id: "olive-oil", qty: 2 },
        ],
        steps: ["Simmer cooked lentils with vegetables and curry spices.", "Serve with rice and a spoon of yogurt."],
        notes: null,
      },
    ] as Omit<MealTemplate, "updated_at">[]
  ).map((t) => ({ ...t, updated_at: SEED_TIME }));

export const DEFAULT_TEMPLATE: Record<"breakfast" | "lunch" | "dinner", string> = {
  breakfast: "breakfast-eggs-yogurt",
  lunch: "lunch-overnight-oats",
  dinner: "dinner-chicken-rice",
};
