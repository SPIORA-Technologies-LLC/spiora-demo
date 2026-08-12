"use client";

import { useEffect, useId, useState } from "react";
import type { AppLocale } from "@/i18n/config";
import {
  formatQuestionnaireDate,
  parseQuestionnaireDate,
} from "@/lib/client-portal/questionnaire-date";
import styles from "./QuestionnaireDateField.module.css";

type QuestionnaireDateFieldProps = {
  id: string;
  value: string;
  locale: AppLocale;
  placeholder: string;
  readOnly?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  onChange: (isoOrEmpty: string) => void;
};

export function QuestionnaireDateField({
  id,
  value,
  locale,
  placeholder,
  readOnly = false,
  invalid = false,
  describedBy,
  className,
  onChange,
}: QuestionnaireDateFieldProps) {
  const pickerId = useId();
  const [text, setText] = useState(() =>
    value ? formatQuestionnaireDate(value, locale) : "",
  );

  useEffect(() => {
    setText(value ? formatQuestionnaireDate(value, locale) : "");
  }, [value, locale]);

  function commitText(next: string) {
    setText(next);
    const trimmed = next.trim();
    if (!trimmed) {
      onChange("");
      return;
    }
    const iso = parseQuestionnaireDate(trimmed, locale);
    if (iso) onChange(iso);
  }

  function onBlur() {
    const trimmed = text.trim();
    if (!trimmed) {
      setText("");
      onChange("");
      return;
    }
    const iso = parseQuestionnaireDate(trimmed, locale);
    if (iso) {
      setText(formatQuestionnaireDate(iso, locale));
      onChange(iso);
      return;
    }
    if (value) {
      setText(formatQuestionnaireDate(value, locale));
    }
  }

  return (
    <div className={styles.wrap}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder={placeholder}
        value={text}
        onChange={(e) => commitText(e.target.value)}
        onBlur={onBlur}
        readOnly={readOnly}
        className={[styles.textInput, className].filter(Boolean).join(" ")}
        aria-invalid={invalid}
        aria-describedby={describedBy}
      />
      {!readOnly ? (
        <>
          <label className={styles.pickerHit} htmlFor={pickerId} aria-hidden>
            <svg
              className={styles.pickerIcon}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <rect
                x="3.5"
                y="5.5"
                width="17"
                height="15"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M3.5 10h17M8 3.5v4M16 3.5v4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </label>
          <input
            id={pickerId}
            className={styles.nativePicker}
            type="date"
            lang={locale === "ru" ? "ru-RU" : "en-US"}
            value={value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
            onChange={(e) => {
              const iso = e.target.value;
              onChange(iso);
              setText(iso ? formatQuestionnaireDate(iso, locale) : "");
            }}
            tabIndex={-1}
            aria-hidden
          />
        </>
      ) : null}
    </div>
  );
}
