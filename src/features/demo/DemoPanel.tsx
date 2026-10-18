// Rehearsal controls for the mock backend (?demo=1). Never shipped in VITE_API_MODE=http builds.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { insertTicket } from "../../api/mock";
import { loadState, resetState, updateState } from "../../api/mock/store";
import { useStations } from "../../api/queries";
import type { RiskTier } from "../../api/types";
import { loginDemo, logout, useSession } from "../../auth/session";
import { copy } from "../../copy";
import { tierInfo } from "../../lib/tiers";

const TIERS: RiskTier[] = ["normal", "watch", "warning", "danger"];

const SAMPLE_TICKETS = [
  {
    raw_text: "น้ำเข้าบ้านแล้ว ยายเดินไม่ได้ ช่วยด้วย",
    place: { label: "ต.บ้านป้อม จ.พระนครศรีอยุธยา", lat: 14.375, lon: 100.531 },
    vulnerable: ["elderly", "bedridden"] as const,
    needs: ["evacuation"] as const,
    urgency: "critical" as const,
  },
  {
    raw_text: "ติดอยู่บนหลังคา 3 คน มีเด็ก",
    place: { label: "อ.บางปะหัน", lat: 14.462, lon: 100.552 },
    vulnerable: ["child"] as const,
    needs: ["boat", "evacuation"] as const,
    urgency: "high" as const,
  },
];

export default function DemoPanel() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const stations = useStations();
  const session = useSession();
  const [stationId, setStationId] = useState(2609);
  const [tier, setTier] = useState<RiskTier>("danger");
  const overrides = Object.keys(loadState().tierOverrides).length;

  const refresh = () => qc.invalidateQueries();

  return (
    <div className="fixed right-3 bottom-28 z-[1300] sm:bottom-14">
      {open ? (
        <div className="w-80 rounded-md border border-line-strong bg-surface-raised p-4 text-body text-ink shadow-float">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-heading font-semibold">{copy.demo.title}</h2>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-label font-semibold text-river">
              {copy.map.close}
            </button>
          </div>

          <p className="m-0 mt-3 text-caption font-semibold text-ink-muted">
            {copy.demo.role}: {session ? `${session.display_name} (${session.role})` : "ไม่ได้เข้าสู่ระบบ"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm px-3" onClick={() => loginDemo("responder").then(refresh)}>
              responder
            </button>
            <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm px-3" onClick={() => loginDemo("user").then(refresh)}>
              user
            </button>
            <button type="button" className="nm-btn nm-btn--secondary nm-btn--sm px-3" onClick={() => void logout().then(refresh)}>
              logout
            </button>
          </div>

          <p className="m-0 mt-3 text-caption font-semibold text-ink-muted">{copy.demo.raiseTier}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <select
              aria-label={copy.demo.station}
              value={stationId}
              onChange={(e) => setStationId(Number(e.target.value))}
              className="min-h-11 min-w-0 flex-1 rounded-sm border border-line-strong bg-surface-raised px-2 text-ink"
            >
              {(stations.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.oldcode} {s.name_th}
                </option>
              ))}
            </select>
            <select
              aria-label={copy.demo.tier}
              value={tier}
              onChange={(e) => setTier(e.target.value as RiskTier)}
              className="min-h-11 rounded-sm border border-line-strong bg-surface-raised px-2 text-ink"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {tierInfo(t).label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <button
              type="button"
              className="nm-btn nm-btn--primary nm-btn--sm px-3"
              onClick={() => {
                updateState((s) => {
                  s.tierOverrides[String(stationId)] = tier;
                });
                refresh();
              }}
            >
              {copy.demo.apply}
            </button>
            <button
              type="button"
              className="nm-btn nm-btn--secondary nm-btn--sm px-3"
              onClick={() => {
                updateState((s) => {
                  s.tierOverrides = {};
                });
                refresh();
              }}
            >
              {copy.demo.clearOverrides} {overrides > 0 && `(${overrides})`}
            </button>
          </div>

          <button
            type="button"
            className="nm-btn nm-btn--secondary nm-btn--block mt-3"
            onClick={() => {
              const sample = SAMPLE_TICKETS[Math.floor(Math.random() * SAMPLE_TICKETS.length)];
              updateState((s) =>
                insertTicket(
                  s,
                  {
                    raw_text: sample.raw_text,
                    place: sample.place,
                    vulnerable: [...sample.vulnerable],
                    needs: [...sample.needs],
                    people_count: null,
                    urgency: sample.urgency,
                  },
                  "line",
                ),
              );
              refresh();
            }}
          >
            {copy.demo.injectTicket}
          </button>
          <button
            type="button"
            className="nm-btn nm-btn--secondary nm-btn--block mt-2"
            onClick={() => {
              resetState();
              sessionStorage.removeItem("namma.chat.items");
              refresh();
            }}
          >
            {copy.demo.reset}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="nm-btn nm-btn--secondary nm-btn--sm shadow-float"
        >
          {copy.demo.title}
          {overrides > 0 && ` · จำลอง ${overrides}`}
        </button>
      )}
    </div>
  );
}
