import { useSearchParams } from "react-router";
import { FloodExplorer, type FloodScope } from "./FloodExplorer";

/**
 * The flood tab full screen. Period, layer, year and drill-down live in the URL, so a link opens the same view:
 * ?period=7days, ?layer=history&year=2011. Defaults (3 days, the live layer, all years) are left out.
 */
export default function FloodPage() {
  const [params, setParams] = useSearchParams();
  const province = params.get("province");
  const year = Number(params.get("year"));
  const scope: FloodScope = {
    period: params.get("period") === "7days" ? "7days" : "3days",
    province,
    amphoe: province ? params.get("amphoe") : null,
    history: params.get("layer") === "history",
    year: Number.isInteger(year) && year > 2000 ? year : null,
  };

  const onScope = (changes: Partial<FloodScope>) => {
    const next = new URLSearchParams(params);
    const set = (k: string, v: string | null) => (v == null ? next.delete(k) : next.set(k, v));
    if ("period" in changes) set("period", changes.period === "7days" ? "7days" : null);
    if ("province" in changes) set("province", changes.province ?? null);
    if ("amphoe" in changes) set("amphoe", changes.amphoe ?? null);
    if ("history" in changes) {
      set("layer", changes.history ? "history" : null);
      if (!changes.history) set("year", null);
    }
    if ("year" in changes) set("year", changes.year != null ? String(changes.year) : null);
    setParams(next, { replace: true });
  };

  return <FloodExplorer scope={scope} onScope={onScope} />;
}
