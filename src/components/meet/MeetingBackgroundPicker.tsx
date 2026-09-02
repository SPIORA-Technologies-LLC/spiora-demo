"use client";

import { useEffect, useRef, useState } from "react";
import {
  MEETING_BACKGROUND_PRESETS,
  readStoredMeetingBackground,
  storeMeetingBackground,
  type MeetingBackgroundId,
} from "@/lib/calendar/meeting-backgrounds";
import { useMeetingBackground } from "./useMeetingBackground";
import barStyles from "./MeetingControlBar.module.css";
import styles from "./MeetingBackgroundPicker.module.css";

export function MeetingBackgroundPicker() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<MeetingBackgroundId>("none");
  const wrapRef = useRef<HTMLDivElement>(null);
  const { supported } = useMeetingBackground(selectedId);

  useEffect(() => {
    setSelectedId(readStoredMeetingBackground());
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function selectBackground(id: MeetingBackgroundId) {
    setSelectedId(id);
    storeMeetingBackground(id);
    setOpen(false);
  }

  const isActive = open || selectedId !== "none";

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${barStyles.toggle} ${isActive ? barStyles.toggleActive : ""}`}
        aria-label="Фон видео"
        aria-haspopup="menu"
        aria-expanded={open}
        title={
          supported
            ? "Выбрать фон для видео"
            : "Фон видео недоступен в этом браузере"
        }
        disabled={!supported}
        onClick={() => setOpen((value) => !value)}
      >
        <i className="fa-solid fa-image" aria-hidden="true" />
      </button>

      {open ? (
        <div className={styles.menu} role="menu" aria-label="Фон видео">
          <p className={styles.menuTitle}>Фон видео</p>
          <div className={styles.options}>
            {MEETING_BACKGROUND_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                role="menuitemradio"
                aria-checked={selectedId === preset.id}
                className={[
                  styles.option,
                  selectedId === preset.id ? styles.optionActive : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => selectBackground(preset.id)}
              >
                <span className={styles.preview} aria-hidden="true">
                  {preset.preview ? (
                    <img
                      src={preset.preview}
                      alt=""
                      className={styles.previewImage}
                    />
                  ) : preset.id === "blur" ? (
                    <span className={styles.previewBlur} />
                  ) : (
                    <span className={styles.previewNone}>
                      <i className="fa-solid fa-ban" aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className={styles.optionLabel}>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
