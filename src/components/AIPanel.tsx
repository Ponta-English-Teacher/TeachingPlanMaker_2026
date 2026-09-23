"use client";
import { useEffect, useState } from "react";
import { Plan, Section, Message, StructuredProposal } from "@/lib/plans";
export type Insertion = {
  label: string;
  run: (text: string) => void;
  disabled?: boolean;
};
// A reusable "conversation → structured proposal → review → apply" config,
// shared by the General Plan, Lecture Sequence (Activity Records), and
// Slide Idea. `current` is the baseline the server diffs against: null
// means the teacher is proposing something new; an object means they're
// revising that existing record, so unchanged fields are left alone.
export type ProposalConfig = {
  kind: string; // e.g. "General Plan", "Activity", "Slide"
  fields: Record<string, string>;
  current: Record<string, string> | null;
  onApply: (fields: Record<string, string>) => void;
  // Optional, numbered label for a specific selected item, e.g. "Slide 1".
  // When present it replaces the generic "{kind}" wording in the propose
  // trigger, review header, and apply button, so the action clearly names
  // which item it affects. Leaving it unset (General Plan, Activity) keeps
  // existing wording exactly as-is.
  itemLabel?: string;
};
export default function AIPanel({
  plan,
  section,
  chatKey,
  onMessages,
  actions,
  proposal: proposalConfig,
}: {
  plan: Plan;
  section: Section;
  // Which plan.chats[...] thread to read/write. Defaults to `section`,
  // matching every existing call site (General Plan, Lecture Sequence,
  // Reflection, and Slide Idea/Board Plan when nothing is selected). Pass
  // an explicit per-item key (see visualsChatKey) so each selected slide
  // or board section gets its own independent conversation instead of
  // sharing one thread for the whole tab.
  chatKey?: string;
  onMessages: (m: Message[]) => void;
  actions: Insertion[];
  proposal?: ProposalConfig;
}) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState<StructuredProposal | null>(null);
  const [proposalDraft, setProposalDraft] = useState<StructuredProposal | null>(
    null,
  );
  const [proposalChecked, setProposalChecked] = useState<
    Record<string, boolean>
  >({});
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState("");
  const [applyNotice, setApplyNotice] = useState("");
  const messages = plan.chats[chatKey ?? section] || [];
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured))
      .catch(() =>
        setError("AI status could not be checked. Reload to try again."),
      );
  }, []);
  async function send() {
    if (!prompt.trim() || busy) return;
    const next: Message[] = [
      ...messages,
      { role: "user", content: prompt.trim() },
    ];
    setPrompt("");
    onMessages(next);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          section,
          messages: next.slice(-40),
          // Only for Slide Idea / Board Plan, and only while an item is
          // actually selected — tells the server which item freeform chat
          // should be assumed to be about, so it doesn't ask "which one?".
          // Left out everywhere else (General Plan's "current" means
          // something different — "the plan already has content" — not a
          // selected item, so it must never be sent here).
          current:
            section === "visuals" ? (proposalConfig?.current ?? undefined) : undefined,
          itemKind: section === "visuals" ? proposalConfig?.kind : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onMessages([...next, { role: "assistant", content: data.text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI is unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function propose() {
    if (!proposalConfig || !messages.length || proposing) return;
    setProposing(true);
    setProposeError("");
    setApplyNotice("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          section,
          messages: messages.slice(-40),
          mode: "propose",
          current: proposalConfig.current ?? undefined,
          itemKind: proposalConfig.kind,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const raw = data.proposal as StructuredProposal;
      // The AI sometimes marks a field "changed" even when its proposed
      // text is byte-for-byte identical to the current value — that's
      // noise, not a real change, so it's normalized away here before the
      // review ever renders. A genuine intentional clear (changed:true,
      // value:"") is NOT touched by this — "" is only ever a no-op when
      // the current value was already "".
      const current = proposalConfig.current ?? {};
      const fields: StructuredProposal = {};
      for (const key of Object.keys(proposalConfig.fields)) {
        const f = raw[key];
        const currentValue = current[key] || "";
        fields[key] =
          f.changed && f.value === currentValue
            ? { changed: false, value: f.value }
            : f;
      }
      setProposal(fields);
      setProposalDraft(fields);
      const checked: Record<string, boolean> = {};
      // changed:true is itself the full signal that this is a real,
      // applicable proposal — including an intentional value:"" clear.
      // Never gate on whether the proposed text is non-empty: that would
      // make "clear this field" both unchecked by default AND (elsewhere)
      // unselectable, silently dropping a legitimate change.
      for (const key of Object.keys(proposalConfig.fields))
        checked[key] = fields[key].changed;
      setProposalChecked(checked);
    } catch (e) {
      setProposeError(
        e instanceof Error ? e.message : "The proposal could not be created.",
      );
    } finally {
      setProposing(false);
    }
  }
  const primary = section === "general" || section === "timeline";
  const isRevision = Boolean(proposalConfig?.current);
  // The Stage 3 rebuild's new wording ("Update Slide N from This
  // Discussion", "Slide N — Proposed Changes", "Apply Changes to Slide
  // N") is deliberately scoped to Slide only, via `kind`, not to every
  // itemLabel-bearing proposal — Board Plan keeps its existing wording
  // untouched, and General Plan/Activity never set itemLabel at all.
  const isSlideRevision =
    isRevision && proposalConfig?.kind === "Slide" && Boolean(proposalConfig?.itemLabel);
  return (
    <aside className={`ai-panel${primary ? " ai-panel-primary" : ""}`}>
      <div className="ai-title">
        <span className="spark">✧</span>
        <div>
          <h2>Thinking partner</h2>
          <p>Your ideas. A little perspective.</p>
        </div>
      </div>
      <div className="context-chip">
        Context:{" "}
        {section === "general"
          ? "General Plan"
          : section === "timeline"
            ? "General Plan + Lecture Sequence"
            : section === "visuals"
              ? "General + Sequence + Board / Slides"
              : "Full plan + Reflection"}
      </div>
      {proposalConfig && proposalConfig.current && section !== "general" && (
        <div className="discussing-chip">
          Discussing {proposalConfig.itemLabel || proposalConfig.kind}
          {(() => {
            const nameKey = Object.keys(proposalConfig.fields)[0];
            const name = proposalConfig.current?.[nameKey];
            return name ? `: ${name}` : "";
          })()}
        </div>
      )}
      <p className="hint">
        {proposalConfig
          ? `Discuss here. When you’ve reached agreement on something, propose a structured ${proposalConfig.kind} and review it before applying.`
          : "Discuss first. Select useful text. Insert only when you choose."}
      </p>
      {configured === false && (
        <div className="notice">
          AI is not configured. Add <code>OPENAI_API_KEY</code> to{" "}
          <code>.env.local</code> to enable AI planning.
        </div>
      )}
      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <h3>Make space for your thinking.</h3>
            <p>
              {section === "general"
                ? "“Help me refine my objectives for these students.”"
                : section === "timeline"
                  ? "“First, I want to greet the students and introduce today’s topic.”"
                  : section === "visuals"
                    ? "“Make this slide easier to read.”"
                    : "“Compare my original plan with my reflection.”"}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div className={`message ${m.role}`} key={i}>
            <strong>{m.role === "user" ? "You" : "AI suggestion"}</strong>
            <p
              onMouseUp={() => {
                if (proposalConfig || actions.length === 0) return;
                const selection = window.getSelection()?.toString();
                if (m.role === "assistant" && selection) setDraft(selection);
              }}
            >
              {m.content}
            </p>
            {m.role === "assistant" && !proposalConfig && actions.length > 0 && (
              <button
                onClick={() => {
                  setDraft(m.content);
                  setNotice("");
                }}
              >
                Use this response
              </button>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <label className="field">
        <span>Discuss your plan</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What are you thinking about?"
          rows={primary ? 6 : 4}
        />
      </label>
      <button
        className="primary full"
        disabled={configured !== true || busy || !prompt.trim()}
        onClick={send}
      >
        {busy ? "Thinking…" : "Send to AI ↗"}
      </button>
      <p className="hint">
        Sending shares this section’s context and discussion with OpenAI.
      </p>
      {messages.length > 0 && (
        <button
          disabled={busy}
          onClick={() => {
            if (confirm("Clear this section’s AI discussion?")) {
              onMessages([]);
              setDraft("");
            }
          }}
        >
          Clear discussion
        </button>
      )}
      {proposalConfig && (
        <div className="proposal-trigger">
          <button
            className="full"
            disabled={configured !== true || !messages.length || proposing}
            onClick={propose}
          >
            {proposing
              ? isRevision
                ? "Drafting revision…"
                : "Drafting proposal…"
              : isSlideRevision
                ? `Update ${proposalConfig.itemLabel} from This Discussion`
                : isRevision
                  ? proposalConfig.itemLabel
                    ? `Reflect This Discussion in ${proposalConfig.itemLabel}`
                    : `Update ${proposalConfig.kind} from this conversation`
                  : `Propose ${proposalConfig.kind} from this conversation`}
          </button>
          <p className="hint">
            {isRevision
              ? `Checks this conversation against the current ${proposalConfig.itemLabel || proposalConfig.kind} and proposes only the fields that should change. Nothing is applied until you approve it below.`
              : `Summarizes this discussion into a structured ${proposalConfig.kind} for you to review. Nothing is applied until you approve it below.`}
          </p>
          {proposeError && (
            <p role="alert" className="error">
              {proposeError}
            </p>
          )}
        </div>
      )}
      {proposalConfig && proposal && proposalDraft && (
        <div className="proposal-card">
          <div className="proposal-header">
            <h3>
              {isSlideRevision
                ? `${proposalConfig.itemLabel} — Proposed Changes`
                : isRevision
                  ? proposalConfig.itemLabel
                    ? `${proposalConfig.itemLabel} — Proposed Improvements`
                    : "Proposed Revisions"
                  : `Proposed ${proposalConfig.kind}`}
            </h3>
            <button
              onClick={() => {
                setProposal(null);
                setProposalDraft(null);
              }}
            >
              Discard
            </button>
          </div>
          <p className="hint">
            Review each change. Uncheck or edit anything you don’t want to
            apply — unchecked fields are left exactly as they are.
          </p>
          {(() => {
            const keys = Object.keys(proposalConfig.fields);
            const changedKeys = keys.filter((key) => proposal[key].changed);
            const unchangedKeys = keys.filter((key) => !proposal[key].changed);
            return (
              <>
                {changedKeys.length === 0 ? (
                  <p className="hint">
                    No changes were proposed from this conversation.
                  </p>
                ) : (
                  changedKeys.map((key) => {
                    const value = proposalDraft[key]?.value || "";
                    const current = proposalConfig.current?.[key];
                    return (
                      <div className="proposal-field" key={key}>
                        <label className="proposal-check">
                          <input
                            type="checkbox"
                            checked={Boolean(proposalChecked[key])}
                            onChange={(e) =>
                              setProposalChecked((c) => ({
                                ...c,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          {proposalConfig.fields[key]}
                        </label>
                        {current?.trim() && (
                          <div className="proposal-diff-block">
                            <span className="proposal-diff-label">
                              Current
                            </span>
                            <p className="proposal-diff-current">{current}</p>
                          </div>
                        )}
                        <div className="proposal-diff-block">
                          <span className="proposal-diff-label">
                            Proposed
                          </span>
                          <textarea
                            rows={3}
                            value={value}
                            placeholder="[Clear this field]"
                            onChange={(e) =>
                              setProposalDraft((d) =>
                                d
                                  ? {
                                      ...d,
                                      [key]: { changed: true, value: e.target.value },
                                    }
                                  : d,
                              )
                            }
                          />
                        </div>
                      </div>
                    );
                  })
                )}
                {unchangedKeys.length > 0 && (
                  <details className="proposal-unchanged">
                    <summary>
                      No change proposed for {unchangedKeys.length}{" "}
                      {unchangedKeys.length === 1 ? "field" : "fields"}
                    </summary>
                    <ul>
                      {unchangedKeys.map((key) => (
                        <li key={key}>{proposalConfig.fields[key]}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            );
          })()}
          <button
            className="primary full"
            disabled={
              !Object.keys(proposalConfig.fields).some(
                (key) => proposalChecked[key],
              )
            }
            onClick={() => {
              const fields: Record<string, string> = {};
              for (const key of Object.keys(proposalConfig.fields))
                if (proposalChecked[key])
                  fields[key] = proposalDraft[key].value;
              proposalConfig.onApply(fields);
              setApplyNotice(
                isSlideRevision
                  ? `Applied changes to ${proposalConfig.itemLabel}.`
                  : isRevision
                    ? `Applied the selected changes to ${proposalConfig.itemLabel || `the ${proposalConfig.kind}`}.`
                    : `Added the selected fields as a new ${proposalConfig.kind}.`,
              );
              setTimeout(() => setApplyNotice(""), 4000);
              setProposal(null);
              setProposalDraft(null);
            }}
          >
            {isSlideRevision
              ? `Apply Changes to ${proposalConfig.itemLabel} →`
              : isRevision && proposalConfig.itemLabel
                ? `Apply Selected Changes to ${proposalConfig.itemLabel} →`
                : "Apply Selected Changes →"}
          </button>
        </div>
      )}
      {applyNotice && (
        <p role="status" className="success">
          {applyNotice}
        </p>
      )}
      {!proposalConfig && actions.length > 0 && (
        <div className="insertion">
          <label className="field">
            <span>Selected suggestion · editable</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              placeholder="Select part of an AI response or use the entire response. You may also draft text here."
            />
          </label>
          <p className="hint">
            Only this text will be inserted. Select a stage or item in the
            editor to target it.
          </p>
          <div className="insert-actions">
            {actions.map((a) => (
              <button
                key={a.label}
                disabled={!draft.trim() || a.disabled}
                onClick={() => {
                  a.run(draft);
                  setNotice(`Applied: ${a.label}`);
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
          {notice && (
            <p role="status" className="success">
              {notice}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
