"use client";
import { useState } from "react";
import { Plan } from "@/lib/plans";
// Bulk "propose the whole slide sequence from the Teaching Plan" action.
// This is the primary Stage 3 entry point: a coherent, numbered slide
// sequence for the presentation as a whole, shown compactly for review.
// Nothing changes until the teacher explicitly clicks "Use This Slide
// Sequence" — at that point it REPLACES the current deck (never merges or
// appends), since the point is a coherent whole, not scattered additions.
// Detailed per-field editing happens afterward, by selecting a slide.
export default function DeckProposal({
  plan,
  onApply,
}: {
  plan: Plan;
  onApply: (slides: Record<string, string>[]) => void;
}) {
  const [proposing, setProposing] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState<Record<string, string>[] | null>(
    null,
  );
  const [applied, setApplied] = useState(0);
  async function propose() {
    if (proposing) return;
    setProposing(true);
    setError("");
    try {
      const existing = plan.chats.visuals || [];
      const messages = existing.length
        ? existing.slice(-40)
        : [
            {
              role: "user" as const,
              content: "Propose the slide sequence from the Teaching Plan.",
            },
          ];
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          section: "visuals",
          messages,
          mode: "propose-slides",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProposal(data.slides as Record<string, string>[]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The slide sequence could not be created.",
      );
    } finally {
      setProposing(false);
    }
  }
  return (
    <div className="deck-propose">
      <button className="primary full" disabled={proposing} onClick={propose}>
        {proposing
          ? "Drafting slide plan…"
          : "Propose Slide Plan from Teaching Plan"}
      </button>
      <p className="hint">
        Uses your General Plan and Lecture Sequence to propose a complete,
        coherent slide sequence for the presentation as a whole. Nothing
        changes until you choose to use it.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {proposal && (
        <div className="deck-review">
          <div className="proposal-header">
            <h3>Proposed Slide Plan</h3>
            <button onClick={() => setProposal(null)}>Discard</button>
          </div>
          {plan.slides.length > 0 && (
            <p className="hint">
              Using this sequence replaces your current {plan.slides.length}{" "}
              slide{plan.slides.length === 1 ? "" : "s"}. Nothing changes
              until you approve it below.
            </p>
          )}
          {proposal.length === 0 ? (
            <p className="hint">No slides were proposed.</p>
          ) : (
            <ol className="sequence-summary">
              {proposal.map((slide, i) => (
                <li className="sequence-item" key={i}>
                  <div className="sequence-row deck-preview-row">
                    <span className="sequence-number">{i + 1}</span>
                    <span className="sequence-body">
                      <span className="sequence-name">
                        {slide.title || "Untitled slide"}
                      </span>
                      {slide.content && (
                        <span className="sequence-excerpt">
                          {slide.content}
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {proposal.length > 0 && (
            <button
              className="primary full"
              onClick={() => {
                onApply(proposal);
                setApplied(proposal.length);
                setProposal(null);
              }}
            >
              Use This Slide Plan →
            </button>
          )}
        </div>
      )}
      {applied > 0 && !proposal && (
        <p role="status" className="success">
          Now using the proposed {applied}-slide sequence.
        </p>
      )}
    </div>
  );
}
