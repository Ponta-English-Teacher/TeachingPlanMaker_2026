import { z } from "zod";
export const generalFields = {
  title: "Title",
  students: "Target Students",
  duration: "Class Duration (minutes)",
  objectives: "Objectives",
  content: "Target Content / Materials",
  tools: "Teaching Tools / Apps",
  outcomes: "Expected Learning Outcomes",
  notes: "Notes",
};
// Lecture Sequence "Activity Record" fields. Replaces the older, more
// form-oriented Teacher/Student Behaviors fields — these are meant to be
// mainly derived from AI conversation rather than filled in one box at a
// time. "minutes" keeps its legacy key name so totalMinutes() and the
// numeric <input> handling in ItemEditor/Field need no changes.
export const activityFields = {
  name: "Activity Name",
  summary: "Activity Summary",
  wantToSay: "What I Want to Say",
  questions: "Key Questions / Expressions",
  terminology: "Useful Terminology",
  transition: "Transition to Next Activity",
  minutes: "Approximate Time (minutes, optional)",
  materials: "Materials / Apps (optional)",
};
// "purpose", "question" (Discussion Prompt), and "notes" (Speaker Notes)
// were all retired from the active field set — Stage 3 represents the
// slide itself, not teacher-planning notes, so a discussion/activity
// slide's question or instructions now belong directly in "content"
// (Main Body Content) rather than a separate field. None of these keys
// are stripped out of any Item.values that already have them — old data
// stays intact in storage, it's just never read, rendered, or sent
// anywhere in Stage 3 anymore. On old items without a given key, every
// read site already falls back to "" (e.g. `values[key] || ""`), so no
// migration function is needed, and none is run: existing slide content
// (title/subtitle/content/visual) is left exactly as it was.
export const slideFields = {
  title: "Slide Title",
  subtitle: "Subtitle",
  content: "Main Body Content",
  visual: "Visual Idea",
};
// Presentation-wide AI rules for Slide Idea: a fixed menu of common
// defaults the teacher can toggle per plan, plus one free-text box for
// plan-specific guidance. Applied as background context wherever slide
// content is discussed, proposed, generated, or exported (see
// slideGlobalRulesText() below) — never applied automatically to existing
// slide data, and never sent to Board Plan, which keeps its own separate,
// untouched instructions.
export const slideGlobalRuleOptions = {
  noEarlyReveal: "Do not reveal later content early.",
  simpleDiscussionSlides: "Keep discussion slides visually simple.",
  noInventedContent: "Do not invent facts or content that are not supplied.",
  conciseLanguage: "Use concise student-facing language.",
  preserveSequence: "Preserve the teaching sequence and logic.",
  avoidRewriting: "Avoid unnecessary rewriting of approved content.",
} as const;
export type SlideGlobalRuleKey = keyof typeof slideGlobalRuleOptions;
export const boardFields = {
  area: "Board Section / Area",
  wording: "Exact wording",
  examples: "Examples",
  diagram: "Diagram / arrows description",
  when: "When to write it",
  erase: "When to erase it",
  remain: "What should remain visible",
};
export const reflectionFields = {
  worked: "What worked?",
  didnt: "What did not work?",
  timing: "Actual timing",
  reaction: "Student reaction",
  change: "What should I change next time?",
};
export type Section = "general" | "timeline" | "visuals" | "reflection";
// Structured General Plan proposal fields. Excludes "duration", which is a
// numeric-only field in the form and unsuited to freeform proposed text.
export const proposalFields = [
  "title",
  "students",
  "objectives",
  "content",
  "tools",
  "outcomes",
  "notes",
] as const;
export type ProposalField = (typeof proposalFields)[number];
// Each field's proposal carries its own "did this need to change" verdict,
// so a revision proposal can leave untouched fields alone instead of
// regenerating the whole record on every pass. Reused for General Plan,
// Activity Record, and Slide Idea proposals alike — all three share the
// same conversation → structured proposal → review → apply shape.
export type ProposalFieldResult = { changed: boolean; value: string };
export type StructuredProposal = Record<string, ProposalFieldResult>;
export type Item = {
  id: string;
  values: Record<string, string>;
  show: boolean;
};
export type Message = { role: "user" | "assistant"; content: string };
export const itemSchema = z.object({
  id: z.string(),
  values: z.record(z.string(), z.string()),
  show: z.boolean(),
});
export const planSchema = z.object({
  id: z.string(),
  type: z.enum(["English Class", "Lecture"]),
  general: z.record(z.string(), z.string()),
  timeline: z.array(itemSchema),
  slides: z.array(itemSchema),
  boards: z.array(itemSchema),
  reflection: z.record(z.string(), z.string()),
  summary: z.string(),
  visibility: z.record(z.string(), z.boolean()),
  // Presentation-wide Slide Idea rules (see slideGlobalRuleOptions above).
  // Defaulted so plans saved before this feature existed parse unchanged —
  // they simply load with no global rules set.
  slideGlobalRules: z.array(z.string()).default([]),
  slideGlobalInstructions: z.string().default(""),
  chats: z.record(
    z.string(),
    z.array(
      z.object({ role: z.enum(["user", "assistant"]), content: z.string() }),
    ),
  ),
  updated: z.string(),
});
export type Plan = z.infer<typeof planSchema>;
export const storageSchema = z.object({
  version: z.literal(1),
  plans: z.array(planSchema),
});
export const STORAGE_KEY = "TeachingPlanMaker_2026:v1";
export const uid = () => crypto.randomUUID();
export const item = (values: Record<string, string> = {}): Item => ({
  id: uid(),
  values,
  show: false,
});
export function newPlan(): Plan {
  return {
    id: uid(),
    type: "English Class",
    general: { title: "", students: "", duration: "" },
    timeline: [],
    slides: [],
    boards: [],
    reflection: {},
    summary: "",
    visibility: {},
    slideGlobalRules: [],
    slideGlobalInstructions: "",
    chats: {},
    updated: new Date().toISOString(),
  };
}
// Slide Idea and Board Plan need one chat thread per selected item, not one
// shared thread for the whole section — otherwise switching slides doesn't
// switch the conversation. `plan.chats` stays a plain Record<string,
// Message[]> (no schema change): the bare "visuals" key keeps meaning
// exactly what it always meant — the whole-deck conversation, used when
// nothing is selected — and per-item threads live under new composite
// keys, addressed by the item's stable id so a conversation follows a
// slide/board through reorders rather than a position. Old saved plans'
// existing `chats.visuals` therefore need no migration: it just continues
// to be the whole-deck thread.
export function visualsChatKey(
  kind: "Slide" | "Board",
  id: string | null,
): string {
  return id ? `visuals:${kind.toLowerCase()}:${id}` : "visuals";
}
// Renders the teacher's selected default rules plus their free-text
// instructions as a flat bullet list, or "" if nothing is set. Kept
// separate from the "PRESENTATION-WIDE AI RULES" framing sentence (added
// by each call site) so route.ts and slideGenerationPrompt() can each word
// the override/precedence note to fit their own context.
export function slideGlobalRulesText(p: Plan): string {
  const options: Record<string, string | undefined> = slideGlobalRuleOptions;
  const checked = p.slideGlobalRules
    .map((key) => options[key])
    .filter((label): label is string => Boolean(label));
  const manual = p.slideGlobalInstructions.trim();
  const lines = manual ? [...checked, manual] : checked;
  return lines.map((l) => `- ${l}`).join("\n");
}
export function contextFor(p: Plan, s: Section) {
  return {
    type: p.type,
    general: p.general,
    ...(s !== "general" ? { timeline: p.timeline } : {}),
    ...(s === "visuals" || s === "reflection"
      ? { slides: p.slides, boards: p.boards }
      : {}),
    ...(s === "reflection" ? { reflection: p.reflection } : {}),
  };
}
export function totalMinutes(p: Plan) {
  return p.timeline.reduce((n, r) => n + (Number(r.values.minutes) || 0), 0);
}
export function samplePlan(): Plan {
  const p = newPlan();
  p.type = "Lecture";
  p.general = {
    title: "Issues in English Education in Japan",
    students: "University students in an English teacher-training course",
    duration: "100",
    objectives:
      "Identify major issues in English education in Japan.\nOrganize issues into meaningful categories.\nConsider causes and possible responses.\nDistinguish between teacher-level and system-level issues.",
    content:
      "Teaching Technique\nTeacher-related\nSystemic\nLearner-related\nSocial / Environmental",
    tools: "Slides, whiteboard, sticky notes",
    outcomes:
      "Students explain one issue, its causes, and a possible response.",
    notes: "Allow students to generate ideas before introducing categories.",
  };
  const steps = [
    [
      "Introduce topic",
      "3",
      "Introduce today’s theme.",
      "Connect the topic to previous experience.",
    ],
    [
      "Give open discussion question",
      "3",
      "Ask: What problems exist in English education in Japan?",
      "Think independently before sharing.",
    ],
    [
      "Students discuss freely",
      "10",
      "Listen without imposing categories.",
      "Discuss freely in groups and record ideas.",
    ],
    [
      "Teacher circulates among groups",
      "5",
      "Visit groups and add comments without revealing categories.",
      "Explain ideas and ask questions.",
    ],
    [
      "Collect student ideas",
      "7",
      "Collect and display student ideas without categorizing them yet.",
      "Share one issue from each group.",
    ],
    [
      "Introduce categories",
      "7",
      "Introduce Teaching Technique, Teacher-related, Systemic, Learner-related, and Social / Environmental categories.",
      "Compare these categories with your own ideas.",
    ],
    [
      "Students discuss within categories",
      "10",
      "Invite groups to organize issues into categories.",
      "Categorize issues and justify choices.",
    ],
    [
      "Teacher circulates and asks deeper questions",
      "7",
      "Ask about causes, evidence, and overlapping categories.",
      "Refine explanations.",
    ],
    [
      "Wrap up discussion",
      "5",
      "Summarize patterns and unresolved questions.",
      "Identify an important connection.",
    ],
    [
      "Move from problems to possible responses",
      "5",
      "Ask which problems teachers can influence.",
      "Propose possible responses.",
    ],
    [
      "Discuss what teachers can do",
      "10",
      "Facilitate comparison of practical classroom responses.",
      "Distinguish teacher-level from system-level responses.",
    ],
    [
      "Introduce government / education-policy responses",
      "10",
      "Present policy examples from current course materials.",
      "Compare policy responses with classroom approaches.",
    ],
    [
      "Final discussion",
      "12",
      "Ask groups to defend a feasible response.",
      "Discuss benefits, limitations, and evidence.",
    ],
    [
      "Wrap-up",
      "6",
      "Return to objectives and request an exit reflection.",
      "State one issue, cause, and possible response.",
    ],
  ];
  p.timeline = steps.map(([title, minutes, teacher, student]) =>
    item({
      minutes,
      teacher,
      student,
      materials: "Slides / whiteboard",
      notes: title,
    }),
  );
  const deck = [
    ["Issues in English Education in Japan", "Issues in English Education in Japan", "", "A simple title with a quiet classroom image.", "Introduce the theme without listing categories."],
    ["What problems exist in English education in Japan?", "What problems exist in English education in Japan?", "Discuss freely in groups. Draw on your own experiences.", "An open question with plenty of empty space.", "Keep this slide visible during free discussion and teacher circulation. Do not reveal categories."],
    ["What problems did your group identify?", "Share the issues your group identified.", "Which issue would you like the class to consider?", "Blank space for collecting student contributions.", "Collect students’ ideas before introducing any prepared categories."],
    ["Are these problems random?", "Are these problems random?\nCan we organize them?", "Which ideas seem connected? What groups would you create?", "Unlabelled clusters or movable blank cards.", "Invite students to propose groupings. Do not display the five category names yet."],
    ["Five Categories", p.general.content, "How do your ideas connect with these categories?", "Five clearly labelled groups; show only after open discussion.", "Reveal after students have discussed freely, shared ideas, and considered their own groupings."],
    ["Teaching Technique Problems", "Too much teacher explanation\nToo much grammar / translation / accuracy\nToo little meaningful communication\nWeak connection between activities and objectives", "Which examples connect with your experiences?", "Four concise statements with simple icons.", "Use during discussion within categories; examples are starting points for critique, not a finished diagnosis."],
    ["Systemic Problems", "Entrance exams strongly influence teaching\nLarge classes and limited time\nHeavy teacher workload\nGap between curriculum goals and classroom reality", "How do these conditions affect classroom choices?", "A simple school-system diagram.", "Keep visible as groups explore systemic issues and the teacher circulates."],
    ["Why do these problems happen?", "Why do these problems happen?", "Choose one issue. What causes it? What evidence would help?", "Issue → possible causes, with blank spaces for student ideas.", "Deepen the discussion, then connect causes to possible responses."],
    ["What can teachers change?", "What can teachers change?\nWhat requires system-level change?", "Where could you act as a teacher, and where would you need wider support?", "Two columns: classroom action / system-level change.", "Use through the discussion of feasible teacher responses. Avoid implying teachers can solve every constraint alone."],
    ["What is MEXT trying to change?", "What is MEXT trying to change?", "Which problems do the policy examples aim to address?", "Add a dated policy excerpt and its source from course materials.", "Introduce government / education-policy responses only after teacher-level responses. Supply current, verified course examples; this sample does not assert specific current policies."],
    ["Do these measures address the problems?", "Do these measures address the problems?", "What might improve? What limitations or unanswered questions remain?", "A simple problem → measure → possible effect comparison.", "Use for the final discussion after the policy examples have been introduced."],
    ["One Issue → Cause → Possible Response", "One Issue → Cause → Possible Response", "Explain one issue, its cause, and a possible response.", "Three connected boxes for an exit reflection.", "Return to the objectives and close the lesson."],
  ];
  p.slides = deck.map(([title,content,question,visual,notes])=>item({title,content,question,visual,notes}));
  p.boards = [
    item({
      area: "Left: student ideas",
      wording: "What problems exist in English education in Japan?",
      examples: "Record students’ own examples.",
      diagram: "Ideas → causes → possible responses",
      when: "Stages 2–5",
      erase: "After students record the summary",
      remain: "Lesson question",
    }),
    item({
      area: "Right: categories",
      wording: p.general.content,
      when: "Stage 6, after open discussion",
      erase: "End of lesson",
      remain: "Categories and key connections",
    }),
  ];
  p.summary =
    "Explain one issue, its causes, and a response at teacher or system level.";
  return p;
}

// Upgrade only the exact original demo. Any teacher changes leave the saved plan intact.
export function legacySampleSlides(reference: Plan): Item[] {
  return reference.timeline.map((stage,i)=>item({
    title:stage.values.notes,purpose:stage.values.notes,
    content:i<5?(i===0?reference.general.title:"What problems exist in English education in Japan?"):i===5?reference.general.content:stage.values.notes,
    question:i===1?"What problems exist in English education in Japan?":stage.values.student,
    teacher:stage.values.teacher,student:stage.values.student,notes:`Use with timeline stage ${i+1}.`,
  }));
}
// Converts pre-Lecture-Sequence timeline items (Teacher/Student
// Behaviors/Materials/Notes fields) into the new Activity Record shape.
// Runs once at load time on every plan, so old saved plans and the
// freshly seeded sample (which still builds old-shape rows) both end up
// normalized without changing storage version or losing any teacher text —
// nothing is discarded, it's folded into Activity Summary.
export function migrateLegacyTimeline(plan: Plan): Plan {
  const isLegacy = (values: Record<string, string>) =>
    !("name" in values) &&
    ("teacher" in values || "student" in values || "notes" in values);
  if (!plan.timeline.some((r) => isLegacy(r.values))) return plan;
  return {
    ...plan,
    timeline: plan.timeline.map((r) => {
      if (!isLegacy(r.values)) return r;
      const { teacher = "", student = "", materials = "", notes = "", minutes = "" } =
        r.values;
      const summary = [
        teacher && `Teacher: ${teacher}`,
        student && `Student: ${student}`,
        materials && `Materials: ${materials}`,
      ]
        .filter(Boolean)
        .join("\n");
      return {
        ...r,
        values: {
          name: notes,
          summary,
          wantToSay: teacher,
          questions: "",
          terminology: "",
          transition: "",
          minutes,
          materials,
        },
      };
    }),
  };
}
function sameRecord(a:Record<string,unknown>,b:Record<string,unknown>):boolean {
  return Object.keys(a).length===Object.keys(b).length && Object.keys(a).every(k=>a[k]===b[k]);
}
export function upgradeUntouchedSample(plan:Plan):Plan {
  if(plan.general.title!=="Issues in English Education in Japan"||plan.slides.length!==14)return plan;
  const reference=samplePlan();
  const sameItems=(a:Item[],b:Item[])=>a.length===b.length&&a.every((r,i)=>r.show===b[i].show&&sameRecord(r.values,b[i].values));
  if(plan.type!==reference.type||!sameRecord(plan.general,reference.general)||
    !sameItems(plan.timeline,reference.timeline)||!sameItems(plan.boards,reference.boards)||
    !sameItems(plan.slides,legacySampleSlides(reference))||plan.summary!==reference.summary||
    Object.keys(plan.reflection).length||Object.keys(plan.visibility).length||Object.keys(plan.chats).length)return plan;
  return {...plan,slides:reference.slides.map((s,i)=>({...s,id:plan.slides[i].id})),updated:new Date().toISOString()};
}
