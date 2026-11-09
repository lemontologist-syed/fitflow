// Exercise library: every exercise needs no equipment and fits in a room.
// A chair, bed or wall is mentioned only as an optional support.

export type PoseKey =
  | "squat"
  | "pushup"
  | "lunge"
  | "bridge"
  | "climber"
  | "plank"
  | "jack"
  | "knees"
  | "skater"
  | "burpee"
  | "arms"
  | "hips"
  | "hinge"
  | "stretch"
  | "kneel"
  | "breathe";

export interface Exercise {
  key: string;
  name: string;
  pose: PoseKey;
  /** Easier alternative (another key in this library). */
  easier?: string;
  instructions: string[];
  mistakes: string[];
  modifications: string[];
}

const list: Exercise[] = [
  // ---- Strength ----
  {
    key: "squat",
    name: "Bodyweight squat",
    pose: "squat",
    easier: "chair-squat",
    instructions: [
      "Stand with feet shoulder-width apart, toes slightly out.",
      "Push your hips back and bend your knees as if sitting on a chair.",
      "Go as low as you can with a straight back and heels down.",
      "Drive through your whole foot to stand up tall.",
    ],
    mistakes: ["Heels lifting off the floor", "Knees collapsing inward", "Rounding the lower back"],
    modifications: ["Squat to a chair and stand back up", "Reduce depth until it feels controlled"],
  },
  {
    key: "chair-squat",
    name: "Chair squat (easier)",
    pose: "squat",
    instructions: [
      "Stand in front of a sturdy chair.",
      "Sit back slowly until you lightly touch the seat.",
      "Stand up without using your hands if you can.",
    ],
    mistakes: ["Dropping onto the chair", "Pushing off with the hands"],
    modifications: ["Use a higher seat", "Hold a table edge for balance"],
  },
  {
    key: "pushup",
    name: "Push-up",
    pose: "pushup",
    easier: "incline-pushup",
    instructions: [
      "Hands slightly wider than shoulders, body in one straight line.",
      "Lower your chest toward the floor, elbows about 45° from your body.",
      "Press back up while keeping your core tight.",
    ],
    mistakes: ["Hips sagging or piking up", "Elbows flared straight out", "Half reps without control"],
    modifications: ["Hands on a bed, desk or wall (incline)", "Knees on the floor"],
  },
  {
    key: "incline-pushup",
    name: "Incline or knee push-up (easier)",
    pose: "pushup",
    instructions: [
      "Place hands on a sturdy desk, bed edge or wall — or keep knees on the floor.",
      "Keep a straight line from head to knees or heels.",
      "Lower slowly and press back up.",
    ],
    mistakes: ["Letting the hips drop", "Moving only the head"],
    modifications: ["The higher the hands, the easier it gets"],
  },
  {
    key: "reverse-lunge",
    name: "Reverse lunge",
    pose: "lunge",
    easier: "assisted-lunge",
    instructions: [
      "Stand tall, step one foot back.",
      "Lower until both knees are bent about 90°.",
      "Push through the front heel to return. Count reps per leg.",
    ],
    mistakes: ["Front knee caving inward", "Leaning far forward", "Banging the back knee on the floor"],
    modifications: ["Hold a chair or wall for balance", "Shorter range of motion"],
  },
  {
    key: "assisted-lunge",
    name: "Assisted split squat (easier)",
    pose: "lunge",
    instructions: [
      "Stand in a split stance holding a chair or wall.",
      "Bend both knees a comfortable amount, then rise.",
      "Keep the feet planted; count reps per leg.",
    ],
    mistakes: ["Locking the knees at the top", "Holding the breath"],
    modifications: ["Smaller depth", "Wider stance for balance"],
  },
  {
    key: "glute-bridge",
    name: "Glute bridge",
    pose: "bridge",
    easier: "short-bridge",
    instructions: [
      "Lie on your back, knees bent, feet flat and hip-width apart.",
      "Squeeze your glutes and lift your hips until body forms a line from shoulders to knees.",
      "Pause for one second, then lower slowly.",
    ],
    mistakes: ["Arching the lower back at the top", "Pushing through the toes", "Rushing the lowering"],
    modifications: ["Smaller range", "Single-leg bridge to make it harder"],
  },
  {
    key: "short-bridge",
    name: "Short-range bridge (easier)",
    pose: "bridge",
    instructions: ["Same setup as the glute bridge.", "Lift only a few centimetres and hold one second."],
    mistakes: ["Using the lower back instead of the glutes"],
    modifications: ["Place a pillow under the head for comfort"],
  },
  {
    key: "mountain-climber",
    name: "Mountain climbers",
    pose: "climber",
    easier: "slow-climber",
    instructions: [
      "Start in a high plank, hands under shoulders.",
      "Drive one knee toward the chest, then switch legs.",
      "Keep hips level and move at a steady rhythm.",
    ],
    mistakes: ["Hips bouncing high", "Shoulders drifting behind the hands"],
    modifications: ["Step the feet in slowly", "Hands on a bed or sofa"],
  },
  {
    key: "slow-climber",
    name: "Slow step-in climbers (easier)",
    pose: "climber",
    instructions: ["High plank with hands on the floor or a bed edge.", "Step one knee in at a time, slowly."],
    mistakes: ["Holding the breath"],
    modifications: ["Higher hand position makes it easier"],
  },
  {
    key: "plank",
    name: "Forearm plank",
    pose: "plank",
    easier: "knee-plank",
    instructions: [
      "Forearms on the floor, elbows under shoulders.",
      "Straight line from head to heels; squeeze glutes and brace the stomach.",
      "Breathe steadily for the whole time.",
    ],
    mistakes: ["Sagging hips", "Hips too high", "Looking up and straining the neck"],
    modifications: ["Knees on the floor", "Hold for shorter sets"],
  },
  {
    key: "knee-plank",
    name: "Knee plank (easier)",
    pose: "plank",
    instructions: ["Forearms and knees on the floor.", "Keep a straight line from head to knees."],
    mistakes: ["Bending at the hips"],
    modifications: ["Rest a few seconds and continue"],
  },
  // ---- Conditioning ----
  {
    key: "jumping-jack",
    name: "Jumping jacks",
    pose: "jack",
    easier: "step-jack",
    instructions: ["Jump feet out while raising arms overhead.", "Jump back to start. Land softly."],
    mistakes: ["Landing on the heels", "Locked knees"],
    modifications: ["Step one foot out at a time (no jump) — quieter for neighbours"],
  },
  {
    key: "step-jack",
    name: "Step jacks (easier, quiet)",
    pose: "jack",
    instructions: ["Step one foot to the side while raising the arms.", "Return and switch sides."],
    mistakes: ["Rushing so form gets sloppy"],
    modifications: ["Arms to shoulder height only"],
  },
  {
    key: "high-knees",
    name: "High knees",
    pose: "knees",
    easier: "march",
    instructions: ["Run in place lifting knees toward hip height.", "Pump the arms and stay on the balls of the feet."],
    mistakes: ["Leaning back", "Landing heavily"],
    modifications: ["March in place with high knees"],
  },
  {
    key: "march",
    name: "Marching in place",
    pose: "knees",
    instructions: ["March on the spot, lifting knees comfortably.", "Swing the arms naturally."],
    mistakes: ["Slouching"],
    modifications: ["Hold a wall if balance is an issue"],
  },
  {
    key: "skater",
    name: "Skater steps",
    pose: "skater",
    easier: "side-tap",
    instructions: [
      "Step or hop sideways onto one leg, sweeping the other leg behind.",
      "Swing the arms across like a speed skater, then switch sides.",
    ],
    mistakes: ["Knee collapsing inward on landing", "Stiff landings"],
    modifications: ["Step instead of hop", "Smaller side distance"],
  },
  {
    key: "side-tap",
    name: "Side step taps (easier)",
    pose: "skater",
    instructions: ["Step to the side and tap the other foot next to it.", "Alternate sides at a brisk pace."],
    mistakes: ["Moving only the feet without using the hips"],
    modifications: ["Add arm swings for more intensity"],
  },
  {
    key: "burpee",
    name: "Burpees",
    pose: "burpee",
    easier: "step-burpee",
    instructions: [
      "Squat down and place hands on the floor.",
      "Jump or step the feet back to a plank.",
      "Return feet to hands, stand up and reach overhead (add a small jump if comfortable).",
    ],
    mistakes: ["Sagging hips in the plank", "Landing with straight knees"],
    modifications: ["Step back instead of jumping", "Skip the jump at the top"],
  },
  {
    key: "step-burpee",
    name: "Step-back burpee (easier)",
    pose: "burpee",
    instructions: ["Hands to the floor, step back one foot at a time to a plank.", "Step forward and stand up. No jump."],
    mistakes: ["Rounding the back when bending down"],
    modifications: ["Hands on a chair seat instead of the floor"],
  },
  // ---- Warm-up ----
  {
    key: "warm-march",
    name: "March in place",
    pose: "knees",
    instructions: ["Easy marching to raise your heart rate.", "Gradually lift knees higher."],
    mistakes: ["Starting too fast"],
    modifications: ["Hold a wall"],
  },
  {
    key: "arm-circles",
    name: "Arm circles",
    pose: "arms",
    instructions: ["Arms out to the sides.", "Make small circles growing larger; switch direction halfway."],
    mistakes: ["Shrugging the shoulders"],
    modifications: ["Smaller circles"],
  },
  {
    key: "hip-circles",
    name: "Hip circles",
    pose: "hips",
    instructions: ["Hands on hips, feet hip-width.", "Draw big slow circles with the hips; switch direction."],
    mistakes: ["Moving the shoulders instead of the hips"],
    modifications: ["Smaller circles"],
  },
  {
    key: "hip-hinge",
    name: "Hip hinge (good mornings)",
    pose: "hinge",
    instructions: ["Hands on hips, soft knees.", "Push hips back with a flat back, then stand tall."],
    mistakes: ["Rounding the back"],
    modifications: ["Smaller range"],
  },
  {
    key: "leg-swings",
    name: "Leg swings",
    pose: "knees",
    instructions: ["Hold a wall and swing one leg forward and back.", "Switch legs halfway."],
    mistakes: ["Forcing the range"],
    modifications: ["Smaller swings"],
  },
  // ---- Cooldown ----
  {
    key: "quad-stretch",
    name: "Standing quad stretch",
    pose: "stretch",
    instructions: ["Hold a wall, pull one heel toward your glutes.", "Switch legs halfway. Breathe slowly."],
    mistakes: ["Arching the lower back"],
    modifications: ["Hold the sock or trouser leg if you can't reach the foot"],
  },
  {
    key: "hamstring-stretch",
    name: "Hamstring stretch",
    pose: "hinge",
    instructions: ["One heel forward, toes up.", "Hinge at the hips until you feel a gentle stretch. Switch halfway."],
    mistakes: ["Bouncing", "Rounding the back"],
    modifications: ["Bend the standing knee more"],
  },
  {
    key: "hip-flexor-stretch",
    name: "Kneeling hip-flexor stretch",
    pose: "lunge",
    instructions: ["Half-kneel with one knee down (use a pillow).", "Squeeze the glute and shift forward slightly. Switch halfway."],
    mistakes: ["Arching the lower back"],
    modifications: ["Do it standing in a split stance"],
  },
  {
    key: "chest-stretch",
    name: "Chest and shoulder opener",
    pose: "arms",
    instructions: ["Clasp hands behind your back or hold a door frame.", "Open the chest gently."],
    mistakes: ["Forcing the shoulders"],
    modifications: ["One arm at a time on a door frame"],
  },
  {
    key: "childs-pose",
    name: "Child's pose",
    pose: "kneel",
    instructions: ["Kneel, sit back on your heels, reach arms forward on the floor.", "Relax and breathe into your back."],
    mistakes: ["Holding tension in the shoulders"],
    modifications: ["Pillow under the hips or knees"],
  },
  {
    key: "breathing",
    name: "Slow breathing",
    pose: "breathe",
    instructions: ["Stand or sit comfortably.", "Inhale for 4 seconds, exhale for 6 seconds."],
    mistakes: ["Breathing into the chest only"],
    modifications: ["Lie down if you prefer"],
  },
];

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(list.map((e) => [e.key, e]));

export function exercise(key: string): Exercise {
  const e = EXERCISES[key];
  if (!e) throw new Error(`Unknown exercise ${key}`);
  return e;
}

/** Exercises that have an easier alternative (shown in the preferences list). */
export const MAIN_EXERCISES = list.filter((e) => e.easier);
