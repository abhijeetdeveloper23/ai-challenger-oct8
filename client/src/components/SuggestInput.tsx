import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { filterSuggestions } from "../data/suggestions";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  id?: string;
  /** Compact field for the unified search dock */
  variant?: "default" | "dock";
  icon?: ReactNode;
}

export function SuggestInput({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  required,
  minLength = 2,
  id,
  variant = "default",
  icon,
}: Props) {
  const autoId = useId();
  const inputId = id || autoId;
  const listId = `${inputId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const filtered = filterSuggestions(suggestions, value);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function select(item: string) {
    onChange(item);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.value);
    setOpen(true);
    setActiveIndex(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      setActiveIndex(0);
      e.preventDefault();
      return;
    }

    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        i <= 0 ? filtered.length - 1 : i - 1
      );
    } else if (e.key === "Enter" && activeIndex >= 0 && filtered[activeIndex]) {
      e.preventDefault();
      select(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const dock = variant === "dock";

  return (
    <div
      ref={containerRef}
      className={`relative block text-sm ${dock ? "min-w-0 flex-1" : ""}`}
    >
      {!dock && (
        <label htmlFor={inputId} className="mb-1.5 block font-medium text-ink">
          {label}
        </label>
      )}
      {dock && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-muted"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {dock && icon && (
          <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-ink-muted">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined
          }
          required={required}
          minLength={minLength}
          value={value}
          onChange={onInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={
            dock
              ? "w-full border-0 bg-transparent py-1.5 pl-7 pr-7 text-base font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-muted/70"
              : "w-full rounded-lg border border-border bg-white py-2.5 pl-3 pr-9 text-ink outline-none focus:border-accent"
          }
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Show ${label.toLowerCase()} suggestions`}
          onClick={() => setOpen((o) => !o)}
          className={`absolute inset-y-0 right-0 flex items-center text-ink-muted hover:text-ink ${
            dock ? "px-0" : "px-2.5"
          }`}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>

      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-white py-1 shadow-lg shadow-ink/15"
        >
          {filtered.map((item, index) => {
            const active = index === activeIndex;
            return (
              <li
                key={item}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(item);
                }}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  active ? "bg-accent-soft font-medium text-accent" : "text-ink"
                }`}
              >
                {item}
              </li>
            );
          })}
        </ul>
      )}

      {open && filtered.length === 0 && value.trim() && (
        <div className="absolute left-0 right-0 z-50 mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink-muted shadow-lg">
          No matches — you can still type a custom value
        </div>
      )}
    </div>
  );
}
