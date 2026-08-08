"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import styles from "./FilterSelect.module.css";

export type FilterSelectOption = {
  value: string;
  label: string;
};

type FilterSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
};

export function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  disabled = false,
}: FilterSelectProps) {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open || disabled) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, disabled]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((prev) => !prev);
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div
      ref={wrapRef}
      className={[
        styles.wrap,
        disabled ? styles.wrapDisabled : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        className={[styles.trigger, open ? styles.triggerOpen : ""]
          .filter(Boolean)
          .join(" ")}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.triggerLabel}>
          {selected?.label ?? ariaLabel}
        </span>
        <span className={[styles.chevron, open ? styles.chevronOpen : ""]
          .filter(Boolean)
          .join(" ")}
          aria-hidden
        >
          <svg viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M1 1.5L6 6.5L11 1.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && !disabled ? (
        <ul
          id={listboxId}
          className={styles.menu}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || "__empty"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    styles.option,
                    isSelected ? styles.optionSelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className={styles.optionLabel}>{option.label}</span>
                  {isSelected ? (
                    <span className={styles.check} aria-hidden>
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M3.5 8.2L6.6 11.3L12.5 4.7"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
