import { Item, Plan, slideFields, slideGlobalRulesText } from "./plans";

export type SlideValues = {
  title: string;
  subtitle: string;
  content: string;
  visual: string;
};
// Deliberately does not read slide.values.purpose, .question, or .notes —
// all retired from the active field set (see plans.ts). Old text in those
// keys stays untouched in storage but is never surfaced here, in the
// editor, or in the slide-generation handoff.
export function slideValues(slide: Item): SlideValues {
  return {
    title: slide.values.title || "",
    subtitle: slide.values.subtitle || "",
    content: slide.values.content || "",
    visual: slide.values.visual || "",
  };
}
export function fullSlidePlan(slides: Item[]) {
  return slides
    .map((slide, i) => {
      const values = slideValues(slide);
      const lines = [`Slide ${i + 1} — ${values.title || "Untitled slide"}`];
      // Subtitle is normally only present on the title slide — omit the
      // line entirely when empty rather than printing "(Not specified)",
      // so the export doesn't imply every slide should have one.
      if (values.subtitle.trim())
        lines.push(`${slideFields.subtitle}:\n${values.subtitle}`);
      lines.push(`${slideFields.content}:\n${values.content || "(Not specified)"}`);
      lines.push(`${slideFields.visual}:\n${values.visual || "(Not specified)"}`);
      return lines.join("\n\n");
    })
    .join("\n\n---\n\n");
}
export function slideGenerationPrompt(plan: Plan) {
  const rulesText = slideGlobalRulesText(plan);
  const rulesBlock = rulesText
    ? `\n\nPresentation-wide rules set by the teacher for this presentation — apply these in addition to the instructions above:\n${rulesText}`
    : "";
  return `Create a presentation using the following approved slide plan.\nPreserve the slide order, numbering, titles, subtitles, and body content exactly as given.\nDo not remove or rewrite content unless necessary for visual presentation.\nDo not reveal information earlier than indicated.\nKeep discussion slides visually simple.\nUse concise student-facing text.\nSlide Title, Subtitle, and Main Body Content are visible slide text. Treat Visual Idea as guidance for building the slide, not visible slide text itself.\nSubtitle is normally present only on the title slide (Slide 1) — do not invent a subtitle for a slide that has none.\nDo not invent policy details or facts not supplied in the plan.${rulesBlock}\n\nTeacher context — guidance only, not extra slides:\nTitle: ${plan.general.title||"Not specified"}\nTarget students: ${plan.general.students||"Not specified"}\nClass duration: ${plan.general.duration?plan.general.duration+" minutes":"Not specified"}\nObjectives: ${plan.general.objectives||"Not specified"}\nLecture sequence (do not reveal later content early):\n${plan.timeline.map((r,i)=>`${i+1}. ${r.values.name||"Untitled activity"} — ${r.values.summary||r.values.wantToSay||""}`).join("\n")}\n\nSLIDE PLAN\n\n${fullSlidePlan(plan.slides)}`;
}
// Speaker Notes are deliberately NOT part of the active 4-field slide
// model (see slideFields in plans.ts) — they're stored as separate keys
// on the same Item (slide.values.speakerNotes / .speakerNotesSnapshot),
// keyed implicitly by the slide's own stable id, so they survive reorder
// exactly like title/subtitle/content/visual already do.
//
// speakerNotesSnapshot() captures the four source fields at the moment
// notes were generated. Comparing a slide's current snapshot against its
// stored one is the entire staleness check — no field-change tracking is
// wired into updateSlideField/applySlideProposal, this is purely a
// derived comparison computed wherever it's needed.
export function speakerNotesSnapshot(slide: Item): string {
  const v = slideValues(slide);
  return JSON.stringify([v.title, v.subtitle, v.content, v.visual]);
}
export function speakerNotesStale(slide: Item): boolean {
  return Boolean(
    slide.values.speakerNotes &&
      slide.values.speakerNotesSnapshot !== speakerNotesSnapshot(slide),
  );
}
// The plain-text handoff for "Copy Speaker Notes" — the finished notes,
// prefixed with placement instructions for Claude embedded in PowerPoint.
// This is NOT a generation prompt: the notes are already written here;
// the downstream AI's only job is matching each note to the right slide
// by content (never by position alone, since a slide could be inserted,
// removed, or reordered in PowerPoint after export) and placing it into
// that slide's Notes area, showing its proposed matching for approval
// first, and never touching slide titles, content, or layout.
export function speakerNotesExport(slides: Item[]) {
  const instructions = `I have already created the Speaker Notes for this presentation.\n\nPlease place each Speaker Note into the Notes section of the appropriate PowerPoint slide.\n\nBefore making any changes, read the visible content of every slide and match each note to the correct slide based on:\n- slide title\n- slide content\n- topic\n- meaning\n\nDo not assign notes automatically only by slide number.\n\nFirst show me your proposed slide-to-note matching so I can confirm it.\n\nAfter I approve the matching, place each Speaker Note into the Notes area of the corresponding slide.\n\nDo not change:\n- slide titles\n- subtitles\n- body content\n- images\n- layout\n- formatting\n- slide order\n\nYour task is only to place the already-written Speaker Notes into the correct PowerPoint Notes sections.`;
  const notes = slides
    .map(
      (slide, i) =>
        `Slide ${i + 1} — Speaker Notes\n${slide.values.speakerNotes || "(No notes generated yet.)"}`,
    )
    .join("\n\n");
  return `${instructions}\n\n${notes}`;
}
