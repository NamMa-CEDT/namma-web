import { useSearchParams } from "react-router";
import { PERIODS } from "../../lib/flood";
import { readFloodFocus } from "../../lib/floodLink";
import { FloodExplorer, type FloodScope } from "./FloodExplorer";

/**
 * The flood tab full screen. Period, layer, year and drill-down live in the URL, so a link opens the same view:
 * ?period=7days, ?period=30days, ?layer=history&year=2011. Defaults (3 days, the live layer, all years) are left out.
 * A chat answer links here with ?lat=…&lon=…&place=… to open the map on the place it was about.
 */
export default function FloodPage() {
  const [params, setParams] = useSearchParams();
  const province = params.get("province");
  const year = Number(params.get("year"));
  const period = PERIODS.find((p) => p === params.get("period")) ?? "3days";
  const focus = readFloodFocus(params);
  const scope: FloodScope = {
    period,
    province,
    amphoe: province ? params.get("amphoe") : null,
    history: params.get("layer") === "history",
    year: Number.isInteger(year) && year > 2000 ? year : null,
  };

  const onScope = (changes: Partial<FloodScope>) => {
    const next = new URLSearchParams(params);
    const set = (k: string, v: string | null) => (v == null ? next.delete(k) : next.set(k, v));
    if ("period" in changes) set("period", changes.period && changes.period !== "3days" ? changes.period : null);
    if ("province" in changes) set("province", changes.province ?? null);
    if ("amphoe" in changes) set("amphoe", changes.amphoe ?? null);
    if ("history" in changes) {
      set("layer", changes.history ? "history" : null);
      if (!changes.history) set("year", null);
    }
    if ("year" in changes) set("year", changes.year != null ? String(changes.year) : null);
    setParams(next, { replace: true });
  };

  return <FloodExplorer scope={scope} onScope={onScope} focus={focus} />;
}
