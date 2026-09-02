"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MEETING_BACKGROUND_PRESETS } from "@/lib/calendar/meeting-backgrounds";
import { useMeetingBackgroundContext } from "./MeetingBackgroundContext";
import barStyles from "./MeetingControlBar.module.css";
import styles from "./MeetingBackgroundPicker.module.css";

type MenuPosition = {
  left: number;
  bottom: number;
  width: number;
};

export function MeetingBackgroundPicker() {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { selectedId, selectBackground, supported } = useMeetingBackgroundContext();

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) {
      setMenuPosition(null);
      return;
    }

    function updatePosition() {
      const wrap = wrapRef.current;
      if (!wrap) {
        return;
      }

      const rect = wrap.getBoundingClientRect();
      const width = Math.min(18 * 16, window.innerWidth - 24);
      const centered = rect.left + rect.width / 2 - width / 2;
      const left = Math.max(
        12,
        Math.min(centered, window.innerWidth - width - 12),
      );
      const bottom = Math.max(12, window.innerHeight - rect.top + 10);

      setMenuPosition({ left, bottom, width });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

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

  function pickBackground(id: typeof selectedId) {
    selectBackground(id);
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

      {open && menuPosition ? (
        <div
          className={styles.menu}
          role="menu"
          aria-label="Фон видео"
          style={{
            left: menuPosition.left,
            bottom: menuPosition.bottom,
            width: menuPosition.width,
          }}
        >
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
                onClick={() => pickBackground(preset.id)}
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
