import { Link } from "react-router";
import { ArrowRightIcon } from "../../components/icons";
import { HotlineNotice } from "../../components/HotlineNotice";
import { LogoMark } from "../../components/Logo";
import { copy } from "../../copy";
import { LINE_OA_URL } from "../../lib/line";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="m-0 text-heading font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function AboutPage() {
  const a = copy.about;
  return (
    <div className="h-full overflow-y-auto">
      <article className="mx-auto grid max-w-3xl gap-10 px-4 py-8 sm:px-6">
        <header className="grid gap-4">
          <LogoMark size={56} />
          <h1 className="m-0 text-title font-semibold">{a.title}</h1>
          <p className="m-0 text-body-lg">{a.lead}</p>
          <p className="m-0 text-body text-ink-muted">{a.who}</p>
        </header>

        <Section id="about-why" title={a.whyTitle}>
          {a.why.map((t) => (
            <p key={t} className="m-0 text-body">
              {t}
            </p>
          ))}
        </Section>

        <Section id="about-do" title={a.doTitle}>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {a.features.map((f) => (
              <li key={f.h} className="grid content-start gap-1 rounded-md border border-line bg-surface-raised p-4">
                <span className="text-body font-semibold">{f.h}</span>
                <span className="text-body text-ink-muted">{f.b}</span>
                {f.to && (
                  <Link to={f.to} className="inline-flex min-h-11 items-center gap-1 justify-self-start font-semibold text-river">
                    {f.cta}
                    <ArrowRightIcon />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="about-data" title={a.dataTitle}>
          <p className="m-0 text-body">{a.dataIntro}</p>
          <dl className="m-0 grid gap-0 rounded-md border border-line">
            {a.data.map((d, i) => (
              <div key={d.what} className={`grid gap-0.5 p-4 sm:grid-cols-[10rem_1fr] sm:gap-4 ${i ? "border-t border-line" : ""}`}>
                <dt className="text-body font-semibold">{d.what}</dt>
                <dd className="m-0 grid gap-0.5">
                  <span className="text-body">{d.who}</span>
                  <span className="text-caption text-ink-muted">{d.how}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section id="about-tech" title={a.techTitle}>
          <ul className="m-0 grid list-none gap-4 p-0">
            {a.tech.map((t) => (
              <li key={t.h} className="grid gap-0.5 border-l-[3px] border-river pl-4">
                <span className="text-body font-semibold">{t.h}</span>
                <span className="text-body text-ink-muted">{t.b}</span>
              </li>
            ))}
          </ul>
          <p className="m-0 text-caption text-ink-muted">{a.stack}</p>
        </Section>

        <Section id="about-diff" title={a.diffTitle}>
          <p className="m-0 text-body">{a.diffIntro}</p>
          <div className="rounded-md border border-line">
            {/* Column names for wide screens (screen readers get them per row); on phones each row shows them. */}
            <div className="hidden grid-cols-2 gap-4 border-b border-line px-4 py-2 text-caption text-ink-muted sm:grid" aria-hidden="true">
              <span>{a.diffFrom}</span>
              <span className="font-semibold text-river">{a.diffTo}</span>
            </div>
            <ul className="m-0 list-none p-0">
              {a.diff.map((d, i) => (
                <li key={d.to} className={`grid gap-1 p-4 sm:grid-cols-2 sm:gap-4 ${i ? "border-t border-line" : ""}`}>
                  <span className="grid text-body text-ink-muted">
                    <span className="text-caption sm:sr-only">{a.diffFrom}</span>
                    {d.from}
                  </span>
                  <span className="grid text-body">
                    <span className="text-caption font-semibold text-river sm:sr-only">{a.diffTo}</span>
                    {d.to}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="about-limits" title={a.limitsTitle}>
          <ul className="m-0 grid gap-1.5 pl-5 text-body">
            {a.limits.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Section>

        <Section id="about-cta" title={a.ctaTitle}>
          <div className="flex flex-wrap gap-3">
            <Link to="/chat" className="nm-btn nm-btn--primary no-underline">
              {a.ctaChat}
            </Link>
            {LINE_OA_URL && (
              <a className="nm-btn nm-btn--line" href={LINE_OA_URL} target="_blank" rel="noreferrer">
                {copy.line.addFriend}
              </a>
            )}
          </div>
          <HotlineNotice />
          <p className="m-0 flex flex-wrap gap-x-4 text-caption">
            <Link to="/privacy" className="text-ink-muted underline">
              {copy.legal.privacyLink}
            </Link>
            <Link to="/pdpa" className="text-ink-muted underline">
              {copy.legal.pdpaLink}
            </Link>
          </p>
        </Section>
      </article>
    </div>
  );
}
