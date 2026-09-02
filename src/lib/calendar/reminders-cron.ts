import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listActiveCalendarUserIds } from "./active-users";
import * as sbDeliveries from "@/lib/supabase/calendar-reminder-deliveries-repo";
import {
  REMINDER_OFFSETS_MINUTES,
} from "./constants";
import {
  getEventScanRangeIso,
  getReminderDeliveryCandidate,
  resolveReminderRecipientIds,
} from "./reminders";
import { listEventsInRangeForReminders } from "./store";
import type {
  CalendarEvent,
  CalendarReminderDelivery,
  InsertCalendarReminderDeliveryInput,
  ReminderOffsetMinutes,
} from "./types";

export type ReminderCronResult = {
  processed: number;
  sent: number;
  skipped: number;
  duplicates: number;
  failed: number;
};

export type ReminderCronDeps = {
  listEventsInRange: (
    from: string,
    to: string,
  ) => Promise<CalendarEvent[]>;
  listActiveUserIds: () => Promise<string[]>;
  tryInsertDelivery: (
    input: InsertCalendarReminderDeliveryInput,
  ) => Promise<CalendarReminderDelivery | null>;
  onDelivery?: (params: {
    event: CalendarEvent;
    delivery: CalendarReminderDelivery;
    offsetMinutes: ReminderOffsetMinutes;
  }) => Promise<void>;
};

export async function deliverCalendarReminderNotification(params: {
  event: CalendarEvent;
  delivery: CalendarReminderDelivery;
  offsetMinutes: ReminderOffsetMinutes;
}): Promise<void> {
  const { notifyCalendarReminder } = await import("@/lib/notifications/emit");
  const notification = await notifyCalendarReminder({
    event: params.event,
    offsetMinutes: params.offsetMinutes,
    userId: params.delivery.userId,
  });

  if (!isSupabaseConfigured()) return;

  await sbDeliveries.sbUpdateReminderDeliveryNotificationId(
    params.delivery.id,
    notification.id,
  );
}

export const defaultReminderCronDeps: ReminderCronDeps = {
  listEventsInRange: listEventsInRangeForReminders,
  listActiveUserIds: listActiveCalendarUserIds,
  tryInsertDelivery: sbDeliveries.sbTryInsertReminderDelivery,
  onDelivery: deliverCalendarReminderNotification,
};

export async function runCalendarReminderCron(
  opts?: {
    now?: Date;
    deps?: Partial<ReminderCronDeps>;
  },
): Promise<ReminderCronResult> {
  const now = opts?.now ?? new Date();
  const nowMs = now.getTime();
  const deps: ReminderCronDeps = {
    ...defaultReminderCronDeps,
    ...opts?.deps,
  };

  const { from, to } = getEventScanRangeIso(nowMs);
  const events = await deps.listEventsInRange(from, to);
  const activeUserIds = await deps.listActiveUserIds();

  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let duplicates = 0;
  let failed = 0;

  for (const event of events) {
    for (const offsetMinutes of REMINDER_OFFSETS_MINUTES) {
      processed += 1;

      const candidate = getReminderDeliveryCandidate(
        event,
        offsetMinutes,
        nowMs,
      );
      if (typeof candidate === "string") {
        skipped += 1;
        continue;
      }

      const recipientIds = resolveReminderRecipientIds(event, activeUserIds);
      if (!recipientIds.length) {
        skipped += 1;
        continue;
      }

      for (const userId of recipientIds) {
        let delivery: CalendarReminderDelivery | null;
        try {
          delivery = await deps.tryInsertDelivery({
            eventId: event.id,
            userId,
            offsetMinutes: candidate.offsetMinutes,
            fireAt: new Date(candidate.fireTargetMs).toISOString(),
            eventUpdatedAt: event.updatedAt,
          });
        } catch (error) {
          failed += 1;
          console.error("[calendar-reminders-cron] insert failed", {
            eventId: event.id,
            userId,
            offsetMinutes: candidate.offsetMinutes,
            error,
          });
          continue;
        }

        if (!delivery) {
          duplicates += 1;
          continue;
        }

        sent += 1;
        if (deps.onDelivery) {
          try {
            await deps.onDelivery({
              event,
              delivery,
              offsetMinutes: candidate.offsetMinutes,
            });
          } catch (error) {
            failed += 1;
            console.error("[calendar-reminders-cron] delivery failed", {
              eventId: event.id,
              userId,
              offsetMinutes: candidate.offsetMinutes,
              deliveryId: delivery.id,
              error,
            });
          }
        }
      }
    }
  }

  return { processed, sent, skipped, duplicates, failed };
}
