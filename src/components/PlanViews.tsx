import {
  Plan,
  generalFields,
  slideFields,
  boardFields,
  reflectionFields,
  totalMinutes,
} from "@/lib/plans";
function Text({ label, value }: { label: string; value?: string }) {
  return value ? (
    <div className="view-field">
      <h4>{label}</h4>
      <p>{value}</p>
    </div>
  ) : null;
}
export function StudentView({ plan: p }: { plan: Plan }) {
  return (
    <article className="student-page">
      <p className="eyebrow">LEARNING TOGETHER</p>
      <h1>{p.general.title || "Today’s lesson"}</h1>
      {p.visibility.objectives && (
        <Text label="Today’s objectives" value={p.general.objectives} />
      )}{" "}
      {p.timeline
        .filter((r) => r.show)
        .map((r, i) => (
          <Text
            key={r.id}
            label={
              r.values.name
                ? `Activity ${i + 1} — ${r.values.name}`
                : `Activity ${i + 1}`
            }
            value={r.values.summary}
          />
        ))}
      {p.slides
        .filter((r) => r.show)
        .map((r, i) => (
          <section className="student-slide" key={r.id}>
            <span className="eyebrow">SLIDE {i + 1}</span>
            <h2>{r.values.title}</h2>
            {r.values.subtitle && <p>{r.values.subtitle}</p>}
            {r.values.content && <p>{r.values.content}</p>}
          </section>
        ))}
      {p.boards
        .filter((r) => r.show)
        .map((r) => (
          <section className="student-slide" key={r.id}>
            <Text label="On the board" value={r.values.wording} />
            <Text label="Examples" value={r.values.examples} />
            <Text label="Connections" value={r.values.diagram} />
          </section>
        ))}
      {p.visibility.summary && <Text label="Final summary" value={p.summary} />}{" "}
      {!p.visibility.objectives &&
        !p.visibility.summary &&
        ![...p.timeline, ...p.slides, ...p.boards].some((r) => r.show) && (
          <p className="muted">
            No content has been marked “Show to Students” yet.
          </p>
        )}
    </article>
  );
}
export function FinalPlan({ plan: p }: { plan: Plan }) {
  return (
    <article className="print-page">
      <p className="eyebrow">TEACHING PLAN</p>
      <h1>{p.general.title || "Untitled teaching plan"}</h1>
      <h2>GENERAL INFORMATION</h2>
      <Text label="Plan Type" value={p.type} />
      <div className="form-grid">
        {Object.entries(generalFields).map(([key, label]) => (
          <Text key={key} label={label} value={p.general[key]} />
        ))}
      </div>
      <h2>LECTURE SEQUENCE</h2>
      <p>
        Planned Time: {totalMinutes(p)} minutes · Class Duration:{" "}
        {p.general.duration || "Not set"}
        {p.general.duration ? " minutes" : ""}
      </p>
      {p.timeline.length === 0 && <p>Not developed yet.</p>}
      {p.timeline.map((r, i) => (
        <section key={r.id}>
          <h3>
            Activity {i + 1}
            {r.values.name ? ` — ${r.values.name}` : ""}
          </h3>
          <p>
            Approximate Time:{" "}
            {r.values.minutes ? `${r.values.minutes} min` : "Undecided"}
          </p>
          <div className="form-grid">
            <Text label="Activity Summary" value={r.values.summary} />
            <Text
              label="What the Teacher Intends to Say / Explain"
              value={r.values.wantToSay}
            />
            <Text
              label="Key Questions / Expressions"
              value={r.values.questions}
            />
            <Text label="Materials / Apps" value={r.values.materials} />
            <Text
              label="Transition to Next Activity"
              value={r.values.transition}
            />
          </div>
        </section>
      ))}
      <h2>BOARD PLAN</h2>
      {p.boards.length === 0 && <p>Not used.</p>}
      {p.boards.map((r, i) => (
        <section key={r.id}>
          <h3>Board {i + 1}</h3>
          <div className="form-grid">
            {Object.entries(boardFields).map(([key, label]) => (
              <Text key={key} label={label} value={r.values[key]} />
            ))}
          </div>
        </section>
      ))}
      <h2>SLIDE IDEA</h2>
      {p.slides.length === 0 && <p>Not used.</p>}
      {p.slides.map((r, i) => (
        <section key={r.id}>
          <h3>Slide {i + 1}</h3>
          <div className="form-grid">
            {Object.entries(slideFields).map(([key, label]) => (
              <Text key={key} label={label} value={r.values[key]} />
            ))}
          </div>
        </section>
      ))}
      <Text label="Final summary" value={p.summary} />
      <h2>POST-LESSON REFLECTION</h2>
      {Object.entries(reflectionFields).map(([key, label]) => (
        <Text key={key} label={label} value={p.reflection[key] || "—"} />
      ))}
    </article>
  );
}
