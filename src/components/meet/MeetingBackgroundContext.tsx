"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  readStoredMeetingBackground,
  resolveMeetingBackgroundMode,
  storeMeetingBackground,
  type MeetingBackgroundId,
} from "@/lib/calendar/meeting-backgrounds";
import { useMeetingBackground } from "./useMeetingBackground";

type MeetingBackgroundContextValue = {
  selectedId: MeetingBackgroundId;
  selectBackground: (id: MeetingBackgroundId) => void;
  supported: boolean;
  isEffectActive: boolean;
};

const MeetingBackgroundContext =
  createContext<MeetingBackgroundContextValue | null>(null);

function MeetingBackgroundMirrorFix({ active }: { active: boolean }) {
  useEffect(() => {
    const room = document.querySelector("[data-ss-meeting-room]");
    if (!room) {
      return;
    }

    if (active) {
      room.setAttribute("data-ss-meeting-background-active", "true");
    } else {
      room.removeAttribute("data-ss-meeting-background-active");
    }

    return () => {
      room.removeAttribute("data-ss-meeting-background-active");
    };
  }, [active]);

  return null;
}

export function MeetingBackgroundProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<MeetingBackgroundId>("none");
  const { supported } = useMeetingBackground(selectedId);

  useEffect(() => {
    setSelectedId(readStoredMeetingBackground());
  }, []);

  const isEffectActive =
    supported && resolveMeetingBackgroundMode(selectedId).type !== "none";

  const value = useMemo(
    () => ({
      selectedId,
      selectBackground: (id: MeetingBackgroundId) => {
        setSelectedId(id);
        storeMeetingBackground(id);
      },
      supported,
      isEffectActive,
    }),
    [isEffectActive, selectedId, supported],
  );

  return (
    <MeetingBackgroundContext.Provider value={value}>
      <MeetingBackgroundMirrorFix active={isEffectActive} />
      {children}
    </MeetingBackgroundContext.Provider>
  );
}

export function useMeetingBackgroundContext(): MeetingBackgroundContextValue {
  const context = useContext(MeetingBackgroundContext);
  if (!context) {
    throw new Error(
      "useMeetingBackgroundContext must be used within MeetingBackgroundProvider",
    );
  }
  return context;
}
