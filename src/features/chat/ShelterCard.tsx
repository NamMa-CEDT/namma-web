import type { CSSProperties } from "react";
import type { Source } from "../../api/types";
import { PinIcon } from "../../components/icons";
import { copy } from "../../copy";
import { formatDistance } from "../../lib/format";

export type ShelterSource = Extract<Source, { type: "shelter" }>;

/** Beyond this a shelter is far (as the backend's FAR_STATION_KM): say to ask 1784 for a nearer one. */
const FAR_KM = 20;

/** True when the source carries the DDPM status (newer backends); otherwise the chat shows the source chip only. */
export function hasShelterDetail(s: ShelterSource): boolean {
  return s.is_open !== undefined;
}

/**
 * Shelters behind a chat answer, best first (the backend ranks by fit, not only distance), in one card: DDPM's
 * open status and occupancy, and whether it takes bedridden patients when that says something for this household.
 */
export function ShelterCard({ shelters }: { shelters: ShelterSource[] }) {
  const many = shelters.length > 1;
  const ddpm = shelters.some((s) => s.source === "ddpm");
  return (
    <section className="nm-shelters w-full max-w-[40rem]" aria-label={many ? copy.shelter.nearby : copy.shelter.recommended}>
      <div className="nm-shelters__head">
        <PinIcon className="shrink-0 text-[18px]" />
        {many ? copy.shelter.nearby : copy.shelter.recommended}
      </div>
      <ul className="m-0 list-none p-0">
        {shelters.map((s, i) => (
          <li key={s.shelter_id} className="nm-shelter">
            <ShelterRow shelter={s} pick={many && i === 0} />
          </li>
        ))}
      </ul>
      <p className="nm-shelters__foot">{ddpm ? copy.shelter.ddpmNote : copy.shelter.manualNote}</p>
    </section>
  );
}

function ShelterRow({ shelter: s, pick }: { shelter: ShelterSource; pick: boolean }) {
  const distance = formatDistance(s.distance_km);
  const unit = s.province === "กรุงเทพมหานคร" ? "เขต" : "อ.";
  const meta = [s.district && `${unit}${s.district}`, distance && `${copy.profile.away} ${distance}`].filter(Boolean);
  const occupancy = s.capacity && s.current_residents != null ? Math.min(100, (s.current_residents / s.capacity) * 100) : null;
  return (
    <>
      <div className="nm-shelter__top">
        <div className="min-w-0">
          {pick && <span className="nm-shelter__pick">{copy.shelter.pick}</span>}
          <h3 className="nm-shelter__name">{s.name}</h3>
          {meta.length > 0 && <div className="nm-shelter__meta num">{meta.join(" · ")}</div>}
        </div>
        {s.is_open === true && <span className="nm-open nm-open--yes">{copy.shelter.open}</span>}
        {s.is_open === false && <span className="nm-open nm-open--no">{copy.shelter.closed}</span>}
      </div>
      <div className="nm-shelter__row">
        {"patients_ok" in s && (
          <span className={`nm-tag ${s.patients_ok == null ? "nm-tag--unknown" : s.patients_ok ? "nm-tag--home" : ""}`}>
            {s.patients_ok ? copy.shelter.patientsYes : s.patients_ok === false ? copy.shelter.patientsNo : copy.shelter.patientsUnknown}
          </span>
        )}
        {occupancy != null && (
          <span className="nm-occ num">
            <span className="nm-occ__bar" aria-hidden="true">
              <span className="nm-occ__fill" style={{ "--fill": occupancy } as CSSProperties} />
            </span>
            {copy.shelter.residents(s.current_residents as number, s.capacity as number)}
          </span>
        )}
        {s.distance_km != null && s.distance_km > FAR_KM && <span className="nm-shelter__far">{copy.shelter.far}</span>}
        {s.lat != null && s.lon != null && (
          <a
            className="nm-shelter__map"
            href={`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`}
            target="_blank"
            rel="noreferrer"
          >
            {copy.shelter.openMap}
          </a>
        )}
      </div>
    </>
  );
}
