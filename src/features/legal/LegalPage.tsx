import { Link } from "react-router";
import { copy } from "../../copy";

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto grid max-w-2xl gap-6 px-4 py-8 sm:px-6">
        <Link to="/" className="text-label text-river underline">
          {copy.legal.back}
        </Link>
        <div className="grid gap-1">
          <h1 className="m-0 text-title font-semibold">{title}</h1>
          <p className="m-0 text-caption text-ink-muted">{copy.legal.updated}</p>
        </div>
        {children}
      </article>
    </div>
  );
}

function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="m-0 grid gap-1.5 pl-5 text-body">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function PrivacyPage() {
  const p = copy.legal.privacy;
  return (
    <Page title={p.title}>
      <p className="m-0 text-body">{p.intro}</p>
      {p.sections.map((s) => (
        <section key={s.h} className="grid gap-2">
          <h2 className="m-0 text-heading font-semibold">{s.h}</h2>
          <List items={s.items} />
        </section>
      ))}
      <p className="m-0 text-body">
        <Link to="/pdpa" className="text-river underline">
          {copy.legal.pdpaLink}
        </Link>
      </p>
    </Page>
  );
}

export function PdpaPage() {
  const p = copy.legal.pdpa;
  return (
    <Page title={p.title}>
      <p className="m-0 text-body">{p.intro}</p>
      <section className="grid gap-3">
        <h2 className="m-0 text-heading font-semibold">{p.rightsTitle}</h2>
        <ul className="m-0 grid list-none gap-3 p-0">
          {p.rights.map((r) => (
            <li key={r.h} className="grid gap-0.5 rounded-md border border-line p-3">
              <span className="text-body font-semibold">{r.h}</span>
              <span className="text-body text-ink-muted">{r.b}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2">
        <h2 className="m-0 text-heading font-semibold">{p.basisTitle}</h2>
        <List items={p.basis} />
      </section>
      <section className="grid gap-2">
        <h2 className="m-0 text-heading font-semibold">{p.howTitle}</h2>
        <p className="m-0 text-body">{p.how}</p>
      </section>
      <p className="m-0 text-body">
        <Link to="/privacy" className="text-river underline">
          {copy.legal.privacyLink}
        </Link>
      </p>
    </Page>
  );
}
