"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import styles from "./CountryCombobox.module.css";

export type CountryComboboxOption = {
  value: string;
  label: string;
};

type MenuPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type Props = {
  id: string;
  value: string;
  options: CountryComboboxOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  className?: string;
};

function filterOptions(
  options: CountryComboboxOption[],
  query: string,
): CountryComboboxOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(q) ||
      option.value.toLowerCase().includes(q),
  );
}

export function CountryCombobox({
  id,
  value,
  options,
  onChange,
  disabled,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  className,
}: Props) {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);

  const selected = options.find((option) => option.value === value);
  const displayValue = open ? query : (selected?.label ?? "");
  const filtered = filterOptions(options, query);

  function close() {
    setOpen(false);
    setQuery("");
    setHighlight(0);
    setPlacement(null);
  }

  function openMenu() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    const selectedIndex = options.findIndex((option) => option.value === value);
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
  }

  function selectOption(next: string) {
    onChange(next);
    close();
    inputRef.current?.blur();
  }

  function updatePlacement() {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const edge = 8;
    const spaceBelow = window.innerHeight - rect.bottom - gap - edge;
    const spaceAbove = rect.top - gap - edge;
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const available = Math.max(40, preferBelow ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(280, available);
    const top = preferBelow
      ? rect.bottom + gap
      : Math.max(edge, rect.top - gap - maxHeight);

    setPlacement({
      top,
      left: Math.max(edge, Math.min(rect.left, window.innerWidth - rect.width - edge)),
      width: rect.width,
      maxHeight,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePlacement();
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        inputRef.current?.blur();
      }
    }

    function onReposition() {
      updatePlacement();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlight((prev) => {
      if (filtered.length === 0) return 0;
      return Math.min(prev, filtered.length - 1);
    });
  }, [filtered.length, open]);

  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setHighlight((prev) =>
        filtered.length === 0 ? 0 : Math.min(prev + 1, filtered.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setHighlight((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      const option = filtered[highlight];
      if (option) selectOption(option.value);
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  }

  const menu =
    open && placement && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            className={styles.menu}
            role="listbox"
            aria-label={placeholder}
            style={{
              top: placement.top,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }}
          >
            {filtered.length === 0 ? (
              <li className={styles.empty} role="presentation">
                {noResultsLabel}
              </li>
            ) : (
              filtered.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === highlight;
                return (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      id={`${listboxId}-opt-${option.value}`}
                      role="option"
                      data-index={index}
                      aria-selected={isSelected}
                      className={[
                        styles.option,
                        isSelected ? styles.optionSelected : "",
                        isActive ? styles.optionActive : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseEnter={() => setHighlight(index)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectOption(option.value);
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div
      ref={wrapRef}
      className={[styles.wrap, className].filter(Boolean).join(" ")}
    >
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && filtered[highlight]
            ? `${listboxId}-opt-${filtered[highlight].value}`
            : undefined
        }
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={open ? searchPlaceholder : placeholder}
        value={displayValue}
        className={[
          styles.input,
          disabled ? styles.inputDisabled : "",
          open ? styles.inputOpen : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onFocus={() => {
          if (!open) openMenu();
        }}
        onClick={() => {
          if (!open) openMenu();
        }}
        onChange={(event) => {
          if (!open) openMenu();
          setQuery(event.target.value);
          setHighlight(0);
        }}
        onKeyDown={handleInputKeyDown}
      />
      <span className={[styles.chevron, open ? styles.chevronOpen : ""].filter(Boolean).join(" ")} aria-hidden>
        ▾
      </span>
      {menu}
    </div>
  );
}
