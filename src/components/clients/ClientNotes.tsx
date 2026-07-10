"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ClientNote } from "@/lib/google-sheets/types";
import { Button } from "@/components/ui/Button";
import styles from "./ClientNotes.module.css";

type ClientNotesProps = {
  clientId: string;
  initialNotes: ClientNote[];
};

export function ClientNotes({ clientId, initialNotes }: ClientNotesProps) {
  const t = useTranslations("clients.notes");
  const tApi = useTranslations("api");
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clients/${encodeURIComponent(clientId)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { notes: ClientNote[] };
        setNotes(data.notes);
        setText("");
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? tApi("noteSaveFailed"));
      }
    } catch {
      setError(tApi("noteSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.form}>
        <textarea
          className={styles.textarea}
          rows={3}
          placeholder={t("placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="button" disabled={saving || !text.trim()} onClick={handleAdd}>
          {saving ? t("saving") : t("add")}
        </Button>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>

      <ul className={styles.list}>
        {notes.length === 0 ? (
          <li className={styles.empty}>{t("empty")}</li>
        ) : (
          notes.map((note) => (
            <li key={note.id} className={styles.note}>
              <div className={styles.noteMeta}>
                <span className={styles.noteDate}>{note.createdAt}</span>
                <span className={styles.noteAuthor}>{note.author}</span>
              </div>
              <p className={styles.noteText}>{note.text}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
