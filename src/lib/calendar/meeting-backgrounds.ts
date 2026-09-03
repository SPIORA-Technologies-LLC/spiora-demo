export type MeetingBackgroundId =
  | "none"
  | "blur"
  | "spiora-office"
  | "spiora-brand-wall"
  | "spiora-desk";

export type MeetingBackgroundPreset = {
  id: MeetingBackgroundId;
  label: string;
  preview?: string;
  imagePath?: string;
};

export const MEETING_BACKGROUND_STORAGE_KEY = "ss-meeting-background";

export const MEETING_BACKGROUND_PRESETS: MeetingBackgroundPreset[] = [
  { id: "none", label: "Без фона" },
  { id: "blur", label: "Размытие" },
  {
    id: "spiora-office",
    label: "Офис Spiora",
    preview: "/meeting-backgrounds/spiora-office.jpg",
    imagePath: "/meeting-backgrounds/spiora-office.jpg",
  },
  {
    id: "spiora-brand-wall",
    label: "Стена Spiora",
    preview: "/meeting-backgrounds/spiora-brand-wall.jpg",
    imagePath: "/meeting-backgrounds/spiora-brand-wall.jpg",
  },
  {
    id: "spiora-desk",
    label: "Рабочее место",
    preview: "/meeting-backgrounds/spiora-desk.jpg",
    imagePath: "/meeting-backgrounds/spiora-desk.jpg",
  },
];

const MEETING_BACKGROUND_IDS = new Set(
  MEETING_BACKGROUND_PRESETS.map((preset) => preset.id),
);

function isMeetingBackgroundId(value: string): value is MeetingBackgroundId {
  return MEETING_BACKGROUND_IDS.has(value as MeetingBackgroundId);
}

export type MeetingBackgroundMode =
  | { type: "none" }
  | { type: "blur"; blurRadius: number }
  | { type: "image"; imagePath: string };

export function resolveMeetingBackgroundMode(
  id: MeetingBackgroundId,
): MeetingBackgroundMode {
  if (id === "blur") {
    return { type: "blur", blurRadius: 12 };
  }

  const preset = MEETING_BACKGROUND_PRESETS.find((item) => item.id === id);
  if (preset?.imagePath) {
    return { type: "image", imagePath: preset.imagePath };
  }

  return { type: "none" };
}

export function readStoredMeetingBackground(): MeetingBackgroundId {
  if (typeof window === "undefined") {
    return "none";
  }

  const raw = sessionStorage.getItem(MEETING_BACKGROUND_STORAGE_KEY);
  if (raw && isMeetingBackgroundId(raw)) {
    return raw;
  }

  return "none";
}

export function storeMeetingBackground(id: MeetingBackgroundId): void {
  sessionStorage.setItem(MEETING_BACKGROUND_STORAGE_KEY, id);
}

export function resolveMeetingBackgroundImageUrl(imagePath: string): string {
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  if (typeof window === "undefined") {
    return imagePath;
  }

  return new URL(imagePath, window.location.origin).toString();
}
