import { useSearchParams } from "react-router";
import type { FloodPeriod } from "../../api/types";
import { FloodExplorer, type FloodScope } from "./FloodExplorer";

/** The flood tab full screen. Period and drill-down live in the URL, so a link opens the same view. */
export default function FloodPage() {
  const [params, setParams] = useSearchParams();
  const province = params.get("province");
  const scope: FloodScope = {
    period: params.get("period") === "7days" ? "7days" : "3days",
    province,
    amphoe: province ? params.get("amphoe") : null,
  };

  const onScope = (changes: Partial<FloodScope>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes) as [keyof FloodScope, string | null][]) {
      // 3 days is the default: left out of the URL.
      const value = k === "period" && (v as FloodPeriod) === "3days" ? null : v;
      if (value == null) next.delete(k);
      else next.set(k, value);
    }
    setParams(next, { replace: true });
  };

  return <FloodExplorer scope={scope} onScope={onScope} />;
}
