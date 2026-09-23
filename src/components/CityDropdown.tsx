"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface CityOption {
  label: string;
  timezone: string;
  latitude: number;
  longitude: number;
}

/**
 * Birth-location dropdown over the world's major cities (searched
 * server-side via /api/cities). Opens on focus with the largest cities;
 * typing narrows the list. Free text is still allowed for places not in
 * the list -- those are geocoded on save instead.
 */
export function CityDropdown({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect: (city: CityOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<CityOption[]>([]);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/cities?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { cities: [] }))
        .then((data: { cities: CityOption[] }) => {
          setOptions(data.cities);
          setActive(data.cities.length ? 0 : -1);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(city: CityOption) {
    onSelect(city);
    setOpen(false);
  }

  function openList() {
    // Opening shows the biggest cities, not just matches for the saved label.
    setQuery("");
    setOpen(true);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openList();
      else setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && open && options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="city-dropdown">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={openList}
        onKeyDown={onKeyDown}
        placeholder="Search a city"
        className="input"
        autoComplete="off"
        required
      />
      <span className="city-dropdown-caret" aria-hidden="true">▾</span>
      {open && (
        <ul ref={listRef} id={listId} role="listbox" className="city-dropdown-list">
          {options.length === 0 ? (
            <li className="city-dropdown-empty" role="option" aria-selected="false" aria-disabled="true">
              Not in the list -- we&apos;ll look it up when you save.
            </li>
          ) : (
            options.map((city, i) => {
              const [name, ...country] = city.label.split(", ");
              return (
                <li
                  key={city.label}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  className="city-dropdown-option"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => choose(city)}
                  onMouseEnter={() => setActive(i)}
                >
                  <span>{name}</span>
                  <span className="city-dropdown-country">{country.join(", ")}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
