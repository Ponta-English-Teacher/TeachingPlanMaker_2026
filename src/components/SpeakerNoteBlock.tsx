"use client";
import { useState } from "react";
import { Item, Plan } from "@/lib/plans";
import { speakerNotesStale } from "@/lib/slides";
// A small, dedicated AI revision flow for one slide's Speaker Notes only —
// deliberately NOT the slide-content proposal engine (AIPanel's
// ProposalConfig/changed/checked machinery). There's only ever one field
// here (the note itself), so a simple current/proposed/apply flow, owned
// entirely as local state in this component, is the smaller, clearer fit.
// Nothing here can touch Slide Title, Subtitle, Main Body Content, Visual
// Idea, or any other slide's notes.
export default function SpeakerNoteBlock({
  plan,
  slide,
  index,
  onChange,
  onApply,
}: {
  plan: Plan;
  slide: Item;
  index: number;
  onChange: (value: string) => void;
  onApply: (value: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposed, setProposed] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function revise() {
    if (!instruction.trim() || proposing) return;
    setProposing(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          section: "visuals",
          messages: [],
          mode: "revise-note",
          current: slide.values,
          itemKind: "Slide",
          instruction,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposed(data.note);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The note could not be revised.",
      );
    } finally {
      setProposing(false);
    }
  }
  return (
    <div className="speaker-note-block">
      <div className="speaker-note-heading">
        <strong>
          Slide {index + 1} — {slide.values.title || "Untitled slide"}
        </strong>
        {speakerNotesStale(slide) && (
          <span className="speaker-note-stale">
            Speaker Notes may be outdated.
          </span>
        )}
      </div>
      <textarea
        rows={4}
        value={slide.values.speakerNotes || ""}
        placeholder="Not generated yet."
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="speaker-note-revise">
        <input
          type="text"
          value={instruction}
          placeholder="AI instruction, e.g. \u201CMake this more general \u2014 don\u2019t reveal later categories yet.\u201D"
          onChange={(e) => setInstruction(e.target.value)}
        />
        <button disabled={!instruction.trim() || proposing} onClick={revise}>
          {proposing ? "Revising\u2026" : "Revise This Note"}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {proposed !== null && (
        <div className="speaker-note-review">
          <div className="proposal-diff-block">
            <span className="proposal-diff-label">Current Note</span>
            <p className="proposal-diff-current">
              {slide.values.speakerNotes || "(empty)"}
            </p>
          </div>
          <div className="proposal-diff-block">
            <span className="proposal-diff-label">Proposed Note</span>
            <textarea
              rows={4}
              value={proposed}
              onChange={(e) => setProposed(e.target.value)}
            />
          </div>
          <div className="speaker-note-review-actions">
            <button
              className="primary"
              onClick={() => {
                onApply(proposed);
                setProposed(null);
                setInstruction("");
              }}
            >
              Apply Revised Note \u2192
            </button>
            <button onClick={() => setProposed(null)}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
