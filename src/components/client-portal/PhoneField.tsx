"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { AppLocale } from "@/i18n/config";
import { countryLabel } from "@/lib/client-portal/questionnaire-countries";
import {
  composeQuestionnairePhone,
  defaultPhoneIso,
  listPhoneDialOptions,
  phoneFlagEmoji,
  splitQuestionnairePhone,
  type PhoneDialOption,
} from "@/lib/client-portal/questionnaire-phone";
import styles from "./PhoneField.module.css";

type MenuPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type Props = {
  id: string;
  value: string;
  locale: AppLocale;
  preferredCountryIso?: string | null;
  onChange: (e164OrEmpty: string) => void;
  disabled?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  codeLabel: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  className?: string;
};

function filterDialOptions(
  options: Array<PhoneDialOption & { label: string; flag: string }>,
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const digits = q.replace(/\D/g, "");
  return options.filter((option) => {
    if (option.label.toLowerCase().includes(q)) return true;
    if (option.iso.toLowerCase().includes(q)) return true;
    if (digits && option.dial.includes(digits)) return true;
    if (q.startsWith("+") && `+${option.dial}`.includes(q)) return true;
    return false;
  });
}

export function PhoneField({
  id,
  value,
  locale,
  preferredCountryIso,
  onChange,
  disabled = false,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  codeLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  className,
}: Props) {
  const listboxId = useId();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const dialBtnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [placement, setPlacement] = useState<MenuPlacement | null>(null);

  const options = useMemo(
    () =>
      listPhoneDialOptions()
        .map((option) => ({
          ...option,
          label: countryLabel(option.iso, locale),
          flag: phoneFlagEmoji(option.iso),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [locale],
  );

  const parsed = useMemo(
    () => splitQuestionnairePhone(value, preferredCountryIso, locale),
    [value, preferredCountryIso, locale],
  );

  const [iso, setIso] = useState(parsed.iso);
  const [national, setNational] = useState(parsed.national);

  useEffect(() => {
    const next = splitQuestionnairePhone(value, preferredCountryIso, locale);
    setIso(next.iso);
    setNational(next.national);
  }, [value, preferredCountryIso, locale]);

  useEffect(() => {
    if (value.trim()) return;
    const nextIso = defaultPhoneIso(preferredCountryIso, locale);
    setIso(nextIso);
  }, [preferredCountryIso, locale, value]);

  const selected =
    options.find((option) => option.iso === iso) ??
    options.find((option) => option.iso === defaultPhoneIso(preferredCountryIso, locale)) ??
    options[0];

  const filtered = filterDialOptions(options, query);

  function close() {
    setOpen(false);
    setQuery("");
    setHighlight(0);
  }

  function emit(nextIso: string, nextNational: string) {
    const dial =
      options.find((option) => option.iso === nextIso)?.dial ??
      selected?.dial ??
      "";
    onChange(composeQuestionnairePhone(dial, nextNational));
  }

  function selectIso(nextIso: string) {
    setIso(nextIso);
    emit(nextIso, national);
    close();
  }

  function updatePlacement() {
    const node = dialBtnRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const gap = 6;
    const maxHeight = Math.min(280, Math.max(140, window.innerHeight - rect.bottom - 16));
    setPlacement({
      top: rect.bottom + gap,
      left: rect.left,
      width: Math.max(rect.width, 280),
      maxHeight,
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    updatePlacement();
    const onScroll = () => updatePlacement();
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlight(0);
  }, [query, open]);

  function onDialKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      setQuery("");
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      dialBtnRef.current?.focus();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((value) => Math.min(value + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((value) => Math.max(value - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlight];
      if (option) selectIso(option.iso);
    }
  }

  const menu =
    open && placement
      ? createPortal(
          <div
            className={styles.menu}
            style={{
              top: placement.top,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
            }}
          >
            <input
              className={styles.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              aria-label={searchPlaceholder}
            />
            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              className={styles.list}
              tabIndex={-1}
              onKeyDown={onListKeyDown}
            >
              {filtered.length === 0 ? (
                <li className={styles.empty}>{noResultsLabel}</li>
              ) : (
                filtered.map((option, index) => (
                  <li key={option.iso} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.iso === selected?.iso}
                      className={[
                        styles.option,
                        index === highlight ? styles.optionActive : "",
                        option.iso === selected?.iso ? styles.optionSelected : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => selectIso(option.iso)}
                    >
                      <span className={styles.optionFlag} aria-hidden>
                        {option.flag}
                      </span>
                      <span className={styles.optionDial}>+{option.dial}</span>
                      <span className={styles.optionLabel}>{option.label}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={wrapRef}
      className={[styles.wrap, className].filter(Boolean).join(" ")}
    >
      <div className={styles.control}>
        <button
          ref={dialBtnRef}
          type="button"
          id={`${id}-dial`}
          className={[styles.dialBtn, open ? styles.dialBtnOpen : ""].filter(Boolean).join(" ")}
          disabled={disabled}
          aria-label={codeLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          onClick={() => {
            if (disabled) return;
            setOpen((value) => !value);
            setQuery("");
          }}
          onKeyDown={onDialKeyDown}
        >
          <span className={styles.flag} aria-hidden>
            {selected?.flag}
          </span>
          <span className={styles.dial}>+{selected?.dial}</span>
          <span className={[styles.chevron, open ? styles.chevronOpen : ""].filter(Boolean).join(" ")} aria-hidden>
            ▾
          </span>
        </button>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          className={styles.numberInput}
          value={national}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          onChange={(event) => {
            const nextNational = event.target.value.replace(/[^\d\s()-]/g, "");
            setNational(nextNational);
            emit(iso, nextNational);
          }}
        />
      </div>
      {menu}
    </div>
  );
}
