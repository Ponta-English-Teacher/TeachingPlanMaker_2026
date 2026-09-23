"use client";
import { Item, uid, Plan, generalFields } from "@/lib/plans";
export function PlanSummary({ plan }: { plan: Plan }) {
  const rows: { label: string; value: string }[] = [
    { label: "Plan Type", value: plan.type },
    ...Object.entries(generalFields).map(([key, label]) => ({
      label,
      value: plan.general[key] || "",
    })),
  ];
  return (
    <dl className="plan-summary">
      {rows.map((row) => (
        <div className="plan-summary-row" key={row.label}>
          <dt>{row.label}</dt>
          <dd className={row.value ? "" : "plan-summary-empty"}>
            {row.value || "Not decided yet"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function Field({
  label,
  value,
  onChange,
  numeric = false,
  onSelect,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  onSelect?: (start: number, end: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {numeric ? (
        <input
          type="number"
          min="0"
          step="any"
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value === ""
                ? ""
                : String(Math.max(0, Number(e.target.value))),
            )
          }
        />
      ) : (
        <textarea
          rows={label === "Title" || label === "Target Students" ? 2 : 3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onSelect={(e) =>
            onSelect?.(
              e.currentTarget.selectionStart,
              e.currentTarget.selectionEnd,
            )
          }
        />
      )}
    </label>
  );
}
export function Share({
  checked,
  onChange,
  label = "Show to Students",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="share">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function ItemEditor({
  items,
  fields,
  kind,
  selected,
  onSelect,
  onChange,
}: {
  items: Item[];
  fields: Record<string, string>;
  kind: string;
  selected: string;
  onSelect: (id: string) => void;
  onChange: (v: Item[]) => void;
}) {
  function update(id: string, key: string, value: string) {
    onChange(
      items.map((r) =>
        r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r,
      ),
    );
  }
  function move(i: number, d: number) {
    const copy = [...items];
    [copy[i], copy[i + d]] = [copy[i + d], copy[i]];
    onChange(copy);
  }
  return (
    <div className="item-list">
      {items.length === 0 && (
        <div className="empty">
          <h3>Your sequence starts here</h3>
          <p>Add as many {kind.toLowerCase()}s as your lesson needs.</p>
        </div>
      )}
      {items.map((r, i) => (
        <section
          className={`item-card ${selected === r.id ? "selected" : ""}`}
          key={r.id}
        >
          <header className="item-header">
            <button
              className="select-item"
              aria-pressed={selected === r.id}
              onClick={() => onSelect(r.id)}
            >
              {kind} {i + 1}
              {selected === r.id ? " · Selected" : ""}
            </button>
            <div className="actions">
              <button
                aria-label={`Move ${kind} ${i + 1} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                ↑
              </button>
              <button
                aria-label={`Move ${kind} ${i + 1} down`}
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button
                onClick={() => {
                  const copy = [...items];
                  copy.splice(i + 1, 0, { ...structuredClone(r), id: uid() });
                  onChange(copy);
                }}
              >
                Duplicate
              </button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm(`Delete ${kind.toLowerCase()} ${i + 1}?`))
                    onChange(items.filter((x) => x.id !== r.id));
                }}
              >
                Delete
              </button>
            </div>
          </header>
          <div className="form-grid">
            {Object.entries(fields).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                numeric={key === "minutes"}
                value={r.values[key] || ""}
                onChange={(v) => update(r.id, key, v)}
              />
            ))}
          </div>
          <Share
            checked={r.show}
            onChange={(show) =>
              onChange(items.map((x) => (x.id === r.id ? { ...x, show } : x)))
            }
          />
          <small className="hint">
            {kind === "Activity"
              ? "Shares the activity summary only."
              : kind === "Slide"
                ? "Shares title, main content, question, and student action only."
                : "Shares exact wording, examples, and diagram description only."}
          </small>
        </section>
      ))}
    </div>
  );
}
export function SequenceSummary({
  items,
  fields,
  selected,
  onSelect,
  onMove,
  emptyHint = "Nothing developed yet — discuss the first part of the lecture, then propose it below.",
  untitled = "Untitled activity",
}: {
  items: Item[];
  fields: Record<string, string>;
  selected: string;
  onSelect: (id: string) => void;
  onMove?: (index: number, direction: -1 | 1) => void;
  emptyHint?: string;
  untitled?: string;
}) {
  const nameKey = Object.keys(fields)[0];
  const summaryKey = Object.keys(fields)[1];
  return (
    <ol className="sequence-summary">
      {items.length === 0 && <p className="hint">{emptyHint}</p>}
      {items.map((r, i) => (
        <li className="sequence-item" key={r.id}>
          <button
            className={`sequence-row${selected === r.id ? " selected" : ""}`}
            aria-pressed={selected === r.id}
            onClick={() => onSelect(selected === r.id ? "" : r.id)}
          >
            <span className="sequence-number">{i + 1}</span>
            <span className="sequence-body">
              <span className="sequence-name">
                {r.values[nameKey] || untitled}
              </span>
              {r.values[summaryKey] && (
                <span className="sequence-excerpt">
                  {r.values[summaryKey]}
                </span>
              )}
            </span>
            {r.values.minutes && (
              <span className="sequence-minutes">{r.values.minutes} min</span>
            )}
          </button>
          {onMove && (
            <div className="sequence-move">
              <button
                aria-label={`Move ${i + 1} up`}
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
              >
                ↑
              </button>
              <button
                aria-label={`Move ${i + 1} down`}
                disabled={i === items.length - 1}
                onClick={() => onMove(i, 1)}
              >
                ↓
              </button>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
