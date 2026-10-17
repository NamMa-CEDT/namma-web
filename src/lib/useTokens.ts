import { useEffect, useState } from "react";

/**
 * Current values of design-system colour tokens, for libraries that take colours as strings
 * (Recharts SVG attributes can't read CSS variables). Updates when the theme changes.
 */
export function useTokens<K extends string>(names: readonly K[]): Record<K, string> {
  const read = () => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])) as Record<K, string>;
  };
  const [values, setValues] = useState(read);
  const key = names.join(",");

  useEffect(() => {
    const update = () => setValues(read());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    update();
    return () => {
      mq.removeEventListener("change", update);
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return values;
}
