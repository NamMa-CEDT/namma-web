import type { CSSProperties } from "react";
import { copy } from "../copy";
import { formatLevel } from "../lib/format";

/** DS gauge: a staff gauge on its side. No house marker: we don't know the house's height. */
export function Gauge({ level, bank }: { level: number | null | undefined; bank: number | null | undefined }) {
  if (level == null || bank == null) return null;
  // Track from 3 m below the bank to 1 m above it, widened to fit the reading.
  const lo = Math.min(bank - 3, level - 0.5);
  const hi = Math.max(bank + 1, level + 0.5);
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const over = level > bank;
  return (
    <div>
      <div
        role="img"
        aria-label={`${copy.station.level} ${formatLevel(level)} ${copy.station.bankLevel} ${formatLevel(bank)}`}
        className={`nm-gauge ${over ? "nm-gauge--over" : ""}`}
        style={{ "--level-pos": pos(level), "--bank-pos": pos(bank) } as CSSProperties}
      >
        <div className="nm-gauge__water" />
        <div className="nm-gauge__ticks" />
        <div className="nm-gauge__bank" />
      </div>
      <div className="nm-gauge-legend">
        <span>
          {copy.station.level} {formatLevel(level)}
        </span>
        <span>
          {copy.station.bankLevel} {formatLevel(bank)}
        </span>
      </div>
    </div>
  );
}
