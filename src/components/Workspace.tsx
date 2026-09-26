"use client";
import { useEffect, useRef, useState } from "react";
import {
  Plan,
  Section,
  STORAGE_KEY,
  storageSchema,
  newPlan,
  samplePlan,
  migrateLegacyTimeline,
  visualsChatKey,
  generalFields,
  proposalFields,
  activityFields,
  slideFields,
  boardFields,
  reflectionFields,
  slideGlobalRuleOptions,
  item,
  uid,
  totalMinutes,
} from "@/lib/plans";
import {
  slideGenerationPrompt,
  speakerNotesSnapshot,
  speakerNotesExport,
} from "@/lib/slides";
import { Field, Share, ItemEditor, PlanSummary, SequenceSummary } from "./Editors";
import AIPanel, { Insertion } from "./AIPanel";
import DeckProposal from "./DeckProposal";
import SpeakerNoteBlock from "./SpeakerNoteBlock";
import { FinalPlan, StudentView } from "./PlanViews";
type Tab = Section | "student";
const tabs: { id: Tab; label: string; number: string }[] = [
  { id: "general", label: "General Plan", number: "01" },
  { id: "timeline", label: "Lecture Sequence", number: "02" },
  { id: "visuals", label: "Slide Idea", number: "03" },
  { id: "student", label: "Student View", number: "04" },
  { id: "reflection", label: "Reflection", number: "05" },
];
const append = (a: string | undefined, b: string) => (a ? `${a}\n${b}` : b);
// The General Plan proposal only covers proposalFields (excludes
// "duration", a numeric-only input) — this label map must match that same
// key set exactly, or the review card would look up a field the server
// never returned.
const generalProposalFields = Object.fromEntries(
  proposalFields.map((k) => [k, generalFields[k]]),
) as Record<string, string>;
export default function Workspace() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [plans, setPlans] = useState<Plan[]>([]),
    [ready, setReady] = useState(false),
    [active, setActive] = useState<string | null>(null),
    [tab, setTab] = useState<Tab>("general"),
    [visual, setVisual] = useState<"slides" | "boards">("slides"),
    [selected, setSelected] = useState(""),
    [creating, setCreating] = useState<Plan | null>(null),
    [final, setFinal] = useState(false),
    [saveError, setSaveError] = useState(""),
    [blocked, setBlocked] = useState(false),
    [saved, setSaved] = useState(false),
    [promptCopied, setPromptCopied] = useState(false),
    [generatingNotes, setGeneratingNotes] = useState(false),
    [notesError, setNotesError] = useState(""),
    [notesCopied, setNotesCopied] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const loaded = raw
        ? storageSchema.parse(JSON.parse(raw)).plans
        : [samplePlan()];
      setPlans(loaded.map(migrateLegacyTimeline));
    } catch {
      setBlocked(true);
      setSaveError(
        "Saved data could not be read. It has not been overwritten. Download a backup before repairing or clearing this browser’s storage.",
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || blocked) return;
    setSaved(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, plans }));
      setSaved(true);
      setSaveError("");
    } catch {
      setSaveError(
        "Changes are in memory but could not be saved. Download a backup before closing this page.",
      );
    }
  }, [plans, ready, blocked]);
  const p = plans.find((p) => p.id === active);
  function change(fn: (p: Plan) => Plan) {
    setPlans((current) =>
      current.map((p) =>
        p.id === active ? { ...fn(p), updated: new Date().toISOString() } : p,
      ),
    );
  }
  function open(id: string) {
    setActive(id);
    setTab("general");
    setSelected("");
    setFinal(false);
  }
  // Export: wraps the app's single localStorage key (STORAGE_KEY) in a
  // small envelope so a backup is self-identifying on import, without
  // altering the shape of the data inside "data" at all — it stays
  // exactly what storageSchema already expects, so import can reuse that
  // same schema for validation instead of a second, parallel one.
  function backup() {
    let data: unknown;
    if (blocked) {
      try {
        data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      } catch {
        data = { version: 1, plans: [] };
      }
    } else {
      data = { version: 1, plans };
    }
    const wrapped = {
      app: "TeachingPlanMaker_2026",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(wrapped, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    a.download = `TeachingPlanMaker_2026_Backup_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  // Import: full replacement only, never a merge — the safest option for
  // a first version. Reuses storageSchema (the same schema the app's own
  // load path trusts) to validate the backup's inner data before ever
  // touching localStorage, so a malformed or foreign file can't corrupt
  // what's already saved.
  async function handleImportFile(file: File) {
    let parsed: unknown;
    try {
      const text = await file.text();
      parsed = JSON.parse(text);
    } catch {
      alert("That file isn't valid JSON. Nothing was changed.");
      return;
    }
    const wrapper = parsed as { app?: unknown; data?: unknown } | null;
    if (
      !wrapper ||
      typeof wrapper !== "object" ||
      wrapper.app !== "TeachingPlanMaker_2026" ||
      !wrapper.data
    ) {
      alert(
        "That file doesn't look like a Teaching Plan Maker backup. Nothing was changed.",
      );
      return;
    }
    const result = storageSchema.safeParse(wrapper.data);
    if (!result.success) {
      alert(
        "That backup file is missing required data and can't be imported safely. Nothing was changed.",
      );
      return;
    }
    if (
      !confirm(
        "Importing this backup will replace the current Teaching Plan Maker data in this browser. Continue?",
      )
    )
      return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
    window.location.reload();
  }
  function applyGeneralProposal(fields: Record<string, string>) {
    change((p) => ({
      ...p,
      general: { ...p.general, ...fields },
    }));
  }
  const selectedActivity = p?.timeline.find((r) => r.id === selected) ?? null;
  function applyTimelineProposal(fields: Record<string, string>) {
    if (selectedActivity) {
      change((p) => ({
        ...p,
        timeline: p.timeline.map((r) =>
          r.id === selectedActivity.id
            ? { ...r, values: { ...r.values, ...fields } }
            : r,
        ),
      }));
      return;
    }
    const row = item(fields);
    change((p) => ({ ...p, timeline: [...p.timeline, row] }));
    setSelected(row.id);
  }
  const selectedSlide =
    visual === "slides" ? (p?.slides.find((r) => r.id === selected) ?? null) : null;
  // Only ever called while a slide is selected — the "propose a brand new
  // slide from scratch" path was replaced by the bulk DeckProposal, which
  // has its own apply function below.
  function applySlideProposal(fields: Record<string, string>) {
    if (!selectedSlide) return;
    change((p) => ({
      ...p,
      slides: p.slides.map((r) =>
        r.id === selectedSlide.id
          ? { ...r, values: { ...r.values, ...fields } }
          : r,
      ),
    }));
  }
  // Replaces the whole deck — never merges/appends. The teacher already
  // reviewed the complete proposed sequence and explicitly approved it as
  // a coherent whole; anything selected from the old deck no longer
  // applies once it's gone.
  function applyDeckProposal(slides: Record<string, string>[]) {
    change((p) => ({ ...p, slides: slides.map((v) => item(v)) }));
    setSelected("");
  }
  function moveSlide(index: number, direction: -1 | 1) {
    change((p) => {
      const copy = [...p.slides];
      [copy[index], copy[index + direction]] = [
        copy[index + direction],
        copy[index],
      ];
      return { ...p, slides: copy };
    });
  }
  function updateSlideField(key: string, value: string) {
    if (!selectedSlide) return;
    change((p) => ({
      ...p,
      slides: p.slides.map((r) =>
        r.id === selectedSlide.id
          ? { ...r, values: { ...r.values, [key]: value } }
          : r,
      ),
    }));
  }
  function updateSlideShow(show: boolean) {
    if (!selectedSlide) return;
    change((p) => ({
      ...p,
      slides: p.slides.map((r) =>
        r.id === selectedSlide.id ? { ...r, show } : r,
      ),
    }));
  }
  function duplicateSlide() {
    if (!selectedSlide) return;
    change((p) => {
      const index = p.slides.findIndex((r) => r.id === selectedSlide.id);
      const copy = [...p.slides];
      copy.splice(index + 1, 0, {
        ...structuredClone(selectedSlide),
        id: uid(),
      });
      return { ...p, slides: copy };
    });
  }
  function deleteSlide() {
    if (!selectedSlide) return;
    if (!confirm("Delete this slide?")) return;
    change((p) => ({
      ...p,
      slides: p.slides.filter((r) => r.id !== selectedSlide.id),
    }));
    setSelected("");
  }
  // Speaker Notes live as extra keys on the same slide Item
  // (speakerNotes / speakerNotesSnapshot) — see slides.ts. Editing a note
  // targets an explicit slideId rather than selectedSlide, since the
  // Speaker Notes panel edits any slide regardless of which one (if any)
  // is currently selected in the main slide editor above it.
  function updateSlideNotes(slideId: string, value: string) {
    change((p) => ({
      ...p,
      slides: p.slides.map((r) =>
        r.id === slideId
          ? { ...r, values: { ...r.values, speakerNotes: value } }
          : r,
      ),
    }));
  }
  // Applying an AI-revised note (see SpeakerNoteBlock) also refreshes the
  // snapshot, since the revision was generated from this slide’s current
  // fields — it’s a fresh note, not a stale one, the moment it’s applied.
  function applyRevisedNote(slideId: string, value: string) {
    change((p) => ({
      ...p,
      slides: p.slides.map((r) =>
        r.id === slideId
          ? {
              ...r,
              values: {
                ...r.values,
                speakerNotes: value,
                speakerNotesSnapshot: speakerNotesSnapshot(r),
              },
            }
          : r,
      ),
    }));
  }
  // Whole-deck generation, matching the teacher's actual workflow (approve
  // the slide plan, then generate notes for all of it in one pass) rather
  // than one slide at a time. Regenerating over existing, possibly
  // hand-edited notes requires confirmation first so a stray click can't
  // silently discard edits.
  async function generateSpeakerNotes() {
    if (!p || p.slides.length === 0 || generatingNotes) return;
    const hasExisting = p.slides.some((s) => s.values.speakerNotes?.trim());
    if (
      hasExisting &&
      !confirm(
        "This will replace all existing Speaker Notes with newly generated ones. Continue?",
      )
    )
      return;
    setGeneratingNotes(true);
    setNotesError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: p,
          section: "visuals",
          messages: [],
          mode: "generate-notes",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const notes: string[] = data.notes;
      change((cur) => ({
        ...cur,
        slides: cur.slides.map((s, i) =>
          i < notes.length
            ? {
                ...s,
                values: {
                  ...s.values,
                  speakerNotes: notes[i],
                  speakerNotesSnapshot: speakerNotesSnapshot(s),
                },
              }
            : s,
        ),
      }));
    } catch (e) {
      setNotesError(
        e instanceof Error
          ? e.message
          : "Speaker Notes could not be generated.",
      );
    } finally {
      setGeneratingNotes(false);
    }
  }
  async function copySpeakerNotes() {
    if (!p) return;
    try {
      await navigator.clipboard.writeText(speakerNotesExport(p.slides));
      setNotesCopied(true);
      setTimeout(() => setNotesCopied(false), 3000);
    } catch {
      alert(
        "Could not copy automatically. Select and copy the notes manually instead.",
      );
    }
  }
  // Board Plan reuses the same conservative selected-item propose/revise
  // flow as Slide Idea (see AIPanel's generic ProposalConfig). The old
  // manual insertion actions (Add as Board Section / Add to Selected Board
  // Wording / Replace Selected Board Wording) are retired in favor of it,
  // matching how they were retired for slides — layout, fields, and
  // "Show to Students" behavior are otherwise untouched.
  const selectedBoard =
    visual === "boards" ? (p?.boards.find((r) => r.id === selected) ?? null) : null;
  function applyBoardProposal(fields: Record<string, string>) {
    if (!selectedBoard) return;
    change((p) => ({
      ...p,
      boards: p.boards.map((r) =>
        r.id === selectedBoard.id
          ? { ...r, values: { ...r.values, ...fields } }
          : r,
      ),
    }));
  }
  const actions: Insertion[] = [];
  if (p && tab === "reflection")
    actions.push({
      label: "Add to Changes for Next Time",
      run: (t) =>
        change((p) => ({
          ...p,
          reflection: {
            ...p.reflection,
            change: append(p.reflection.change, t),
          },
        })),
    });
  if (!ready) return <main className="loading">Opening your workspace…</main>;
  return (
    <>
      <header className="app-header no-print">
        <button
          className="brand"
          onClick={() => {
            setActive(null);
            setFinal(false);
          }}
        >
          <span className="brand-mark">
            T<span>p</span>
          </span>
          <span>
            Teaching Plan Maker
            <small>A WORKSPACE FOR THOUGHTFUL TEACHING</small>
          </span>
        </button>
        <div className="header-right">
          <span className="local-badge">● Local prototype</span>
          <button onClick={backup}>Export Backup</button>
          <button onClick={() => fileInputRef.current?.click()}>
            Import Backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="file-input-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleImportFile(file);
            }}
          />
        </div>
      </header>
      {saveError && (
        <div role="alert" className="error storage-error no-print">
          {saveError}
        </div>
      )}
      {!p ? (
        <main className="home">
          <div className="home-intro">
            <div>
              <p className="eyebrow">YOUR TEACHING WORKSPACE</p>
              <h1>
                Good teaching starts
                <br />
                with a thoughtful plan.
              </h1>
              <p>Think it through. Shape the sequence. Make it your own.</p>
            </div>
            <button
              className="primary"
              disabled={blocked}
              onClick={() => setCreating(newPlan())}
            >
              + New Teaching Plan
            </button>
          </div>
          <div className="section-heading">
            <h2>
              Saved Plans <span className="count">{plans.length}</span>
            </h2>
            <span className="muted">Saved in this browser</span>
          </div>
          <div className="plan-grid">
            {plans.map((plan) => (
              <article className="plan-card" key={plan.id}>
                <span className="type-badge">{plan.type}</span>
                <h2>{plan.general.title || "Untitled teaching plan"}</h2>
                <p>
                  {plan.general.students || "Target students not yet specified"}
                </p>
                <div className="card-meta">
                  <span>
                    {plan.general.duration
                      ? `${plan.general.duration} minutes`
                      : "Duration not set"}
                  </span>
                  <span>
                    Edited {new Date(plan.updated).toLocaleDateString()}
                  </span>
                </div>
                <footer>
                  <button className="primary" onClick={() => open(plan.id)}>
                    Open plan →
                  </button>
                  <button
                    onClick={() => {
                      const copy = {
                        ...structuredClone(plan),
                        id: uid(),
                        general: {
                          ...plan.general,
                          title: `${plan.general.title || "Untitled"} (copy)`,
                        },
                        updated: new Date().toISOString(),
                      };
                      setPlans([...plans, copy]);
                    }}
                  >
                    Duplicate
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (
                        confirm(`Delete “${plan.general.title || "Untitled"}”?`)
                      )
                        setPlans(plans.filter((x) => x.id !== plan.id));
                    }}
                  >
                    Delete
                  </button>
                </footer>
              </article>
            ))}
          </div>
          {plans.length === 0 && !blocked && (
            <div className="empty">
              <h3>A fresh page for your next lesson.</h3>
              <button onClick={() => setPlans([samplePlan()])}>
                Load sample plan
              </button>
            </div>
          )}
          <div className="home-note">
            <strong>Built around your thinking.</strong>
            <p>
              Start with a general plan, develop the lecture sequence
              activity by activity, then sketch a slide idea. AI suggestions
              are always yours to accept, edit, or leave behind.
            </p>
          </div>
        </main>
      ) : (
        <>
          <div className="plan-bar no-print">
            <div>
              <button className="back" onClick={() => setActive(null)}>
                ← All plans
              </button>
              <h1>{p.general.title || "Untitled teaching plan"}</h1>
              <p>
                {p.type} <span> / </span>{" "}
                {p.general.students || "Add your target students"}
              </p>
            </div>
            <div className="plan-bar-actions">
              <span className={saved ? "save-state" : "error"}>
                {saved ? "✓ Saved locally" : "Not saved"}
              </span>
              <button className="primary" onClick={() => setFinal(!final)}>
                {final ? "Back to Editor" : "Generate Teaching Plan"}
              </button>
            </div>
          </div>
          {final ? (
            <>
              <div className="print-toolbar no-print">
                <span>Teaching plan · Teacher copy</span>
                <button onClick={() => window.print()}>
                  Print / Save as PDF
                </button>
              </div>
              <FinalPlan plan={p} />
            </>
          ) : (
            <>
              <nav className="tabs no-print" aria-label="Planning sections">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    aria-current={tab === t.id ? "page" : undefined}
                    onClick={() => {
                      setTab(t.id);
                      setSelected("");
                    }}
                  >
                    <span>{t.number}</span>
                    {t.label}
                  </button>
                ))}
              </nav>
              {tab === "student" ? (
                <>
                  <div className="print-toolbar no-print">
                    <span>
                      Student preview · Only explicitly shared content appears
                      here
                    </span>
                    <button onClick={() => window.print()}>
                      Print Student View
                    </button>
                  </div>
                  <StudentView plan={p} />
                </>
              ) : tab === "general" ? (
                <main className="workspace workspace-conversation">
                  <div className="editor-heading">
                    <p className="eyebrow">01 / THE FOUNDATION</p>
                    <h2>General Plan</h2>
                    <p>
                      What do you want your students to take away? Start with
                      as much or as little detail as you need.
                    </p>
                  </div>
                  <div className="conversation-column">
                    <AIPanel
                      key={`${p.id}-general`}
                      plan={p}
                      section="general"
                      onMessages={(messages) =>
                        change((p) => ({
                          ...p,
                          chats: { ...p.chats, general: messages },
                        }))
                      }
                      actions={[]}
                      proposal={{
                        kind: "General Plan",
                        fields: generalProposalFields,
                        current: proposalFields.some((k) =>
                          p.general[k]?.trim(),
                        )
                          ? p.general
                          : null,
                        onApply: applyGeneralProposal,
                      }}
                    />
                  </div>
                  <aside className="plan-so-far">
                    <p className="eyebrow">PLAN SO FAR</p>
                    <h3>Plan so far</h3>
                    <PlanSummary plan={p} />
                  </aside>
                  <details className="manual-form-toggle">
                    <summary>Edit General Plan manually · open full form</summary>
                    <section className="paper">
                      <div className="form-grid">
                        <label className="field">
                          <span>Plan Type</span>
                          <select
                            value={p.type}
                            onChange={(e) =>
                              change((p) => ({
                                ...p,
                                type: e.target.value as Plan["type"],
                              }))
                            }
                          >
                            <option>English Class</option>
                            <option>Lecture</option>
                          </select>
                        </label>
                        {Object.entries(generalFields).map(([key, label]) => (
                          <div
                            className={
                              ["objectives", "content", "notes"].includes(key)
                                ? "wide"
                                : ""
                            }
                            key={key}
                          >
                            <Field
                              label={label}
                              value={p.general[key] || ""}
                              numeric={key === "duration"}
                              onChange={(v) =>
                                change((p) => ({
                                  ...p,
                                  general: { ...p.general, [key]: v },
                                }))
                              }
                            />
                            {key === "objectives" && (
                              <Share
                                checked={Boolean(p.visibility.objectives)}
                                onChange={(show) =>
                                  change((p) => ({
                                    ...p,
                                    visibility: {
                                      ...p.visibility,
                                      objectives: show,
                                    },
                                  }))
                                }
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  </details>
                </main>
              ) : tab === "timeline" ? (
                <main className="workspace workspace-conversation">
                  <div className="editor-heading">
                    <p className="eyebrow">02 / THE LECTURE SEQUENCE</p>
                    <h2>Lecture Sequence</h2>
                    <p>
                      Go through the lecture activity by activity. Describe
                      what you want to do or say, then propose each part when
                      you’re ready.
                    </p>
                  </div>
                  <div className="conversation-column">
                    <AIPanel
                      key={`${p.id}-timeline-${selected}`}
                      plan={p}
                      section="timeline"
                      onMessages={(messages) =>
                        change((p) => ({
                          ...p,
                          chats: { ...p.chats, timeline: messages },
                        }))
                      }
                      actions={[]}
                      proposal={{
                        kind: "Activity",
                        fields: activityFields,
                        current: selectedActivity?.values ?? null,
                        onApply: applyTimelineProposal,
                      }}
                    />
                  </div>
                  <aside className="plan-so-far">
                    <p className="eyebrow">LECTURE SEQUENCE SO FAR</p>
                    <h3>
                      {p.timeline.length
                        ? `${p.timeline.length} ${p.timeline.length === 1 ? "activity" : "activities"}`
                        : "Lecture sequence so far"}
                    </h3>
                    <div className="timing">
                      <div>
                        <small>Planned Time</small>
                        <strong>
                          {totalMinutes(p)} <span>min</span>
                        </strong>
                      </div>
                      <div>
                        <small>Class Duration</small>
                        <strong>
                          {p.general.duration || "—"} <span>min</span>
                        </strong>
                      </div>
                      <div>
                        <small>Remaining</small>
                        <strong>
                          {p.general.duration !== "" &&
                          p.general.duration !== undefined
                            ? Number(p.general.duration) - totalMinutes(p)
                            : "—"}{" "}
                          <span>min</span>
                        </strong>
                      </div>
                    </div>
                    {p.general.duration &&
                      totalMinutes(p) > Number(p.general.duration) && (
                        <p role="alert" className="warning">
                          Your plan exceeds the class duration by{" "}
                          {totalMinutes(p) - Number(p.general.duration)}{" "}
                          minutes. Review the timing when you’re ready.
                        </p>
                      )}
                    <SequenceSummary
                      items={p.timeline}
                      fields={activityFields}
                      selected={selected}
                      onSelect={setSelected}
                    />
                  </aside>
                  <details className="manual-form-toggle">
                    <summary>
                      Edit Lecture Sequence manually · reorder, duplicate,
                      delete
                    </summary>
                    <ItemEditor
                      items={p.timeline}
                      fields={activityFields}
                      kind="Activity"
                      selected={selected}
                      onSelect={setSelected}
                      onChange={(timeline) =>
                        change((p) => ({ ...p, timeline }))
                      }
                    />
                    <button
                      className="add-button"
                      onClick={() => {
                        const r = item({ minutes: "" });
                        change((p) => ({
                          ...p,
                          timeline: [...p.timeline, r],
                        }));
                        setSelected(r.id);
                      }}
                    >
                      + Add Activity
                    </button>
                  </details>
                </main>
              ) : tab === "visuals" && visual === "slides" ? (
                <main
                  className={`workspace workspace-conversation${selectedSlide ? " slide-editor-active" : ""}`}
                >
                  <div className="editor-heading">
                    <p className="eyebrow">03 / VISUALIZE THE LECTURE</p>
                    <h2>Slide Idea</h2>
                    <p>
                      Propose the whole sequence from your Teaching Plan, then
                      select any slide to discuss and revise just that one —
                      other slides stay untouched.
                    </p>
                  </div>
                  <details className="manual-form-toggle global-rules-toggle">
                    <summary>Presentation-wide AI Rules</summary>
                    <section className="paper">
                      <p className="hint">
                        Applied automatically wherever slide content is
                        discussed, proposed, generated, or exported for this
                        presentation. Changing these never rewrites existing
                        slides on its own — a specific instruction you give
                        while discussing a slide overrides a conflicting rule
                        for that slide only.
                      </p>
                      {Object.entries(slideGlobalRuleOptions).map(
                        ([key, label]) => (
                          <Share
                            key={key}
                            label={label}
                            checked={p.slideGlobalRules.includes(key)}
                            onChange={(checked) =>
                              change((p) => ({
                                ...p,
                                slideGlobalRules: checked
                                  ? [...p.slideGlobalRules, key]
                                  : p.slideGlobalRules.filter(
                                      (k) => k !== key,
                                    ),
                              }))
                            }
                          />
                        ),
                      )}
                      <Field
                        label="Presentation-specific guidance (optional)"
                        value={p.slideGlobalInstructions}
                        onChange={(v) =>
                          change((p) => ({
                            ...p,
                            slideGlobalInstructions: v,
                          }))
                        }
                      />
                    </section>
                  </details>
                  <details className="manual-form-toggle speaker-notes-toggle">
                    <summary>Speaker Notes</summary>
                    <section className="paper">
                      <div className="item-header">
                        <span className="select-item">SPEAKER NOTES</span>
                        <div className="actions">
                          <button
                            disabled={p.slides.length === 0 || generatingNotes}
                            onClick={generateSpeakerNotes}
                          >
                            {generatingNotes
                              ? "Generating…"
                              : p.slides.some((s) =>
                                    s.values.speakerNotes?.trim(),
                                  )
                                ? "Regenerate Speaker Notes"
                                : "Generate Speaker Notes"}
                          </button>
                        </div>
                      </div>
                      <p className="hint">
                        Generates notes for every current slide in one pass,
                        using your General Plan, Lecture Sequence, approved
                        Slide Plan, and Presentation-wide AI Rules. This never
                        changes the slides themselves — only the notes below.
                      </p>
                      {notesError && (
                        <p role="alert" className="error">
                          {notesError}
                        </p>
                      )}
                      {p.slides.length === 0 ? (
                        <p className="hint">
                          Add slides first, then generate notes for them.
                        </p>
                      ) : (
                        p.slides.map((slide, i) => (
                          <SpeakerNoteBlock
                            key={slide.id}
                            plan={p}
                            slide={slide}
                            index={i}
                            onChange={(v) => updateSlideNotes(slide.id, v)}
                            onApply={(v) => applyRevisedNote(slide.id, v)}
                          />
                        ))
                      )}
                      <button
                        disabled={p.slides.length === 0}
                        onClick={copySpeakerNotes}
                      >
                        Copy Speaker Notes
                      </button>
                      <p className="hint">
                        Copies only the finished notes — ready to give to
                        Claude embedded in PowerPoint to place into each
                        slide’s Notes area.
                      </p>
                      {notesCopied && (
                        <p role="status" className="success">
                          Copied to clipboard.
                        </p>
                      )}
                    </section>
                  </details>
                  <div className="segmented">
                    <button
                      aria-pressed={true}
                      onClick={() => setSelected("")}
                    >
                      Slide Idea <span>{p.slides.length}</span>
                    </button>
                    <button
                      aria-pressed={false}
                      onClick={() => {
                        setVisual("boards");
                        setSelected("");
                      }}
                    >
                      Board Plan <span>{p.boards.length}</span>
                    </button>
                  </div>
                  {selectedSlide && (
                    <section className="slide-editor-primary">
                      <div className="item-header">
                        <span className="select-item">
                          Selected Slide{" "}
                          {p.slides.findIndex(
                            (r) => r.id === selectedSlide.id,
                          ) + 1}
                        </span>
                        <div className="actions">
                          <button onClick={duplicateSlide}>Duplicate</button>
                          <button className="danger" onClick={deleteSlide}>
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="slide-editor-fields">
                        {Object.entries(slideFields).map(([key, label]) => (
                          <Field
                            key={key}
                            label={label}
                            value={selectedSlide.values[key] || ""}
                            onChange={(v) => updateSlideField(key, v)}
                          />
                        ))}
                      </div>
                      <Share
                        checked={selectedSlide.show}
                        onChange={updateSlideShow}
                      />
                      <small className="hint">
                        Shares title, subtitle, and main body content only.
                      </small>
                    </section>
                  )}
                  <div className="conversation-column">
                    {!selectedSlide && (
                      <DeckProposal plan={p} onApply={applyDeckProposal} />
                    )}
                    <AIPanel
                      key={`${p.id}-visuals-slides-${selected}`}
                      plan={p}
                      section="visuals"
                      chatKey={visualsChatKey(
                        "Slide",
                        selectedSlide?.id ?? null,
                      )}
                      onMessages={(messages) => {
                        const key = visualsChatKey(
                          "Slide",
                          selectedSlide?.id ?? null,
                        );
                        change((p) => ({
                          ...p,
                          chats: { ...p.chats, [key]: messages },
                        }));
                      }}
                      actions={[]}
                      proposal={
                        selectedSlide
                          ? {
                              kind: "Slide",
                              fields: slideFields,
                              current: selectedSlide.values,
                              onApply: applySlideProposal,
                              itemLabel: `Slide ${p.slides.findIndex((r) => r.id === selectedSlide.id) + 1}`,
                            }
                          : undefined
                      }
                    />
                  </div>
                  <aside className="plan-so-far">
                    <p className="eyebrow">SLIDE PLAN</p>
                    <h3>
                      {p.slides.length
                        ? `${p.slides.length} ${p.slides.length === 1 ? "slide" : "slides"}`
                        : "Slide plan"}
                    </h3>
                    <SequenceSummary
                      items={p.slides}
                      fields={slideFields}
                      selected={selected}
                      onSelect={setSelected}
                      onMove={moveSlide}
                      emptyHint="Nothing proposed yet — use “Propose Slide Plan from Teaching Plan” above."
                      untitled="Untitled slide"
                    />
                    <button
                      className="add-button small"
                      onClick={() => {
                        const r = item();
                        change((p) => ({ ...p, slides: [...p.slides, r] }));
                        setSelected(r.id);
                      }}
                    >
                      + Add Slide
                    </button>
                    <div className="handoff">
                      <button
                        disabled={p.slides.length === 0}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              slideGenerationPrompt(p),
                            );
                            setPromptCopied(true);
                            setTimeout(() => setPromptCopied(false), 3000);
                          } catch {
                            alert(
                              "Could not copy automatically. Select and copy the prompt manually instead.",
                            );
                          }
                        }}
                      >
                        Copy Slide Generation Prompt
                      </button>
                      <p className="hint">
                        Copies the full approved slide plan as a prompt you
                        can paste into Claude, Gamma, or another
                        presentation-generation AI. Content is preserved
                        as-is, not reinterpreted.
                      </p>
                      {promptCopied && (
                        <p role="status" className="success">
                          Copied to clipboard.
                        </p>
                      )}
                    </div>
                  </aside>
                </main>
              ) : (
                <main className="workspace">
                  <div className="editor">
                    <div className="editor-heading">
                      <p className="eyebrow">
                        {tab === "visuals"
                          ? "03 / VISUALIZE THE LECTURE"
                          : "AFTER THE LESSON"}
                      </p>
                      <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
                      <p>
                        {tab === "visuals"
                          ? "Board Plan can hold exact board wording separately from Slide Idea."
                          : "Look back on the lesson, then carry the learning forward."}
                      </p>
                    </div>
                    <details className="inherited">
                      <summary>
                        Inherited context · General Plan + Lecture Sequence
                      </summary>
                      <p>
                        <strong>Objectives:</strong>{" "}
                        {p.general.objectives || "Not yet specified"}
                      </p>
                      <p>
                        <strong>Content:</strong>{" "}
                        {p.general.content || "Not yet specified"}
                      </p>
                      <p>
                        <strong>Duration:</strong>{" "}
                        {p.general.duration || "Not set"}
                      </p>
                      {tab === "visuals" && (
                        <ol>
                          {p.timeline.map((r) => (
                            <li key={r.id}>
                              {r.values.minutes || "0"} min ·{" "}
                              {r.values.name || "Untitled activity"}
                            </li>
                          ))}
                        </ol>
                      )}
                    </details>
                    {tab === "visuals" && (
                      <>
                        <div className="segmented">
                          <button
                            aria-pressed={false}
                            onClick={() => {
                              setVisual("slides");
                              setSelected("");
                            }}
                          >
                            Slide Idea <span>{p.slides.length}</span>
                          </button>
                          <button
                            aria-pressed={true}
                            onClick={() => setSelected("")}
                          >
                            Board Plan <span>{p.boards.length}</span>
                          </button>
                        </div>
                        <p className="hint">
                          Use slides, a board, both, or neither. Each is
                          optional.
                        </p>
                        <ItemEditor
                          items={p.boards}
                          fields={boardFields}
                          kind="Board"
                          selected={selected}
                          onSelect={setSelected}
                          onChange={(boards) =>
                            change((p) => ({ ...p, boards }))
                          }
                        />
                        <button
                          className="add-button"
                          onClick={() => {
                            const r = item();
                            change((p) => ({
                              ...p,
                              boards: [...p.boards, r],
                            }));
                            setSelected(r.id);
                          }}
                        >
                          + Add Board Section
                        </button>
                        <section className="paper summary">
                          <Field
                            label="Final summary for students"
                            value={p.summary}
                            onChange={(summary) =>
                              change((p) => ({ ...p, summary }))
                            }
                          />
                          <Share
                            checked={Boolean(p.visibility.summary)}
                            onChange={(show) =>
                              change((p) => ({
                                ...p,
                                visibility: { ...p.visibility, summary: show },
                              }))
                            }
                          />
                        </section>
                      </>
                    )}
                    {tab === "reflection" && (
                      <section className="paper">
                        <p className="eyebrow">POST-LESSON REFLECTION</p>
                        {Object.entries(reflectionFields).map(
                          ([key, label]) => (
                            <Field
                              key={key}
                              label={label}
                              value={p.reflection[key] || ""}
                              onChange={(v) =>
                                change((p) => ({
                                  ...p,
                                  reflection: { ...p.reflection, [key]: v },
                                }))
                              }
                            />
                          ),
                        )}
                      </section>
                    )}
                  </div>
                  <AIPanel
                    key={`${p.id}-${tab}-${tab === "visuals" ? `${visual}-${selected}` : ""}`}
                    plan={p}
                    section={tab}
                    chatKey={
                      tab === "visuals"
                        ? visualsChatKey("Board", selectedBoard?.id ?? null)
                        : tab
                    }
                    onMessages={(messages) => {
                      const key =
                        tab === "visuals"
                          ? visualsChatKey("Board", selectedBoard?.id ?? null)
                          : tab;
                      change((p) => ({
                        ...p,
                        chats: { ...p.chats, [key]: messages },
                      }));
                    }}
                    actions={actions}
                    proposal={
                      tab === "visuals" && selectedBoard
                        ? {
                            kind: "Board",
                            fields: boardFields,
                            current: selectedBoard.values,
                            onApply: applyBoardProposal,
                            itemLabel: `Board ${p.boards.findIndex((r) => r.id === selectedBoard.id) + 1}`,
                          }
                        : undefined
                    }
                  />
                </main>
              )}
            </>
          )}
        </>
      )}
      {creating && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-plan-title"
          >
            <p className="eyebrow">A NEW BEGINNING</p>
            <h2 id="new-plan-title">New Teaching Plan</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPlans([...plans, creating]);
                open(creating.id);
                setCreating(null);
              }}
            >
              <fieldset>
                <legend>Plan Type</legend>
                <div className="type-options">
                  {(["English Class", "Lecture"] as const).map((type) => (
                    <label key={type}>
                      <input
                        type="radio"
                        name="type"
                        checked={creating.type === type}
                        onChange={() => setCreating({ ...creating, type })}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </fieldset>
              {["title", "students", "duration"].map((key) => (
                <Field
                  key={key}
                  label={generalFields[key as keyof typeof generalFields]}
                  value={creating.general[key] || ""}
                  numeric={key === "duration"}
                  onChange={(v) =>
                    setCreating({
                      ...creating,
                      general: { ...creating.general, [key]: v },
                    })
                  }
                />
              ))}
              <p className="hint">
                Enter any duration. All details can be added or changed later.
              </p>
              <div className="actions">
                <button type="button" onClick={() => setCreating(null)}>
                  Cancel
                </button>
                <button className="primary" type="submit">
                  Create Plan →
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
