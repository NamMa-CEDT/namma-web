import { useId, useState, type KeyboardEvent } from "react";
import type { River } from "../api/types";
import { useRiverSuggestions } from "../api/queries";
import { copy } from "../copy";
import { SearchIcon } from "./icons";

interface Props {
  value: string;
  onChange: (text: string) => void;
  /** A suggestion was chosen (by click or Enter): the caller decides what to show. */
  onPick: (river: River) => void;
  label?: string;
  /** Visible label above the box. Default: none, the input is labelled for screen readers only. */
  showLabel?: boolean;
  className?: string;
}

/**
 * A river name box with suggestions as you type (WAI-ARIA combobox): ↑/↓ move, Enter picks, Esc closes.
 * Matches river names first, then places (province, amphoe, station). Typing again clears the last pick.
 */
export function RiverSearch({ value, onChange, onPick, label = copy.river.search.label, showLabel = false, className = "" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useRiverSuggestions(value);
  const list = value.trim() ? (suggestions.data ?? []) : [];
  const shown = open && list.length > 0;

  const choose = (river: River) => {
    setOpen(false);
    setActive(-1);
    onPick(river);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "ArrowDown" && list.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % list.length);
    } else if (e.key === "ArrowUp" && list.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? list.length - 1 : a - 1));
    } else if (e.key === "Enter" && shown && active >= 0) {
      e.preventDefault();
      choose(list[active]);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={`${id}-input`} className={showLabel ? "mb-2 block text-body font-semibold" : "sr-only"}>
        {label}
      </label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[20px] text-ink-muted" />
        <input
          id={`${id}-input`}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={shown}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={shown && active >= 0 ? `${id}-${active}` : undefined}
          value={value}
          placeholder={copy.river.search.placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
          // Our own "clear" button stands in for the browser's ✕, which would sit under it.
          className={`nm-input min-h-12 pl-12 [&::-webkit-search-cancel-button]:appearance-none ${value ? "pr-24" : ""}`}
        />
        {value && (
          <button
            type="button"
            className="absolute top-1/2 right-2 -translate-y-1/2 px-2 py-1 text-caption font-semibold text-river"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange("");
              setActive(-1);
            }}
          >
            {copy.river.search.clear}
          </button>
        )}
      </div>

      {shown && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-80 list-none overflow-y-auto rounded-md border border-line bg-surface-raised p-1 shadow-float"
        >
          {list.map((r, i) => (
            <li
              key={r.key}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown keeps focus in the box, so the list doesn't close before the click lands
              onMouseDown={(e) => {
                e.preventDefault();
                choose(r);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 ${
                i === active ? "bg-surface-sunken" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block text-body font-semibold">{r.name_th}</span>
                {r.provinces.length > 0 && (
                  <span className="block truncate text-caption text-ink-muted">{r.provinces.slice(0, 3).join(" · ")}</span>
                )}
              </span>
              <span className="num shrink-0 text-caption text-ink-muted">{copy.river.search.stations(r.stations.length)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
