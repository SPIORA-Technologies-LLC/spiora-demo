import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CalendarEvent, CalendarReminderDelivery } from "./types";
import { runCalendarReminderCron } from "./reminders-cron";

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt-1",
    companyId: "northstar-mobility",
    scope: "company",
    ownerUserId: null,
    title: "Company sync",
    description: "",
    eventType: "general",
    videoInviteMode: null,
    guestWaitingRoom: true,
    guestMaxCount: null,
    guestAccessPasswordHash: null,
    guestAccessPasswordSet: false,
    linkedClientId: null,
    linkedClientName: null,
    externalInvitees: [],
    participantUserIds: [],
    startAt: "2026-06-25T08:00:00.000Z",
    endAt: "2026-06-25T09:00:00.000Z",
    allDay: false,
    location: "",
    sendReminders: true,
    createdByUserId: "olivia-bennett",
    createdByName: "Вероника",
    updatedByUserId: null,
    createdAt: "2026-06-20T10:00:00.000Z",
    updatedAt: "2026-06-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("runCalendarReminderCron", () => {
  it("inserts deliveries for company fan-out and deduplicates reruns", async () => {
    const now = new Date("2026-06-25T07:00:00.000Z");
    const deliveries = new Map<string, CalendarReminderDelivery>();
    let insertCalls = 0;

    const deps = {
      listEventsInRange: async () => [event()],
      listActiveUserIds: async () => ["olivia-bennett", "daniel-cooper"],
      tryInsertDelivery: async (input) => {
        insertCalls += 1;
        const key = `${input.eventId}:${input.userId}:${input.offsetMinutes}`;
        if (deliveries.has(key)) return null;

        const delivery: CalendarReminderDelivery = {
          id: `delivery-${insertCalls}`,
          eventId: input.eventId,
          userId: input.userId,
          offsetMinutes: input.offsetMinutes,
          fireAt: input.fireAt,
          notificationId: null,
          eventUpdatedAt: input.eventUpdatedAt,
          createdAt: now.toISOString(),
        };
        deliveries.set(key, delivery);
        return delivery;
      },
    };

    const first = await runCalendarReminderCron({ now, deps });
    assert.equal(first.sent, 4);
    assert.equal(first.duplicates, 0);
    assert.equal(first.skipped, 1);
    assert.equal(deliveries.size, 4);

    const second = await runCalendarReminderCron({ now, deps });
    assert.equal(second.sent, 0);
    assert.equal(second.duplicates, 4);
  });

  it("skips events with reminders disabled", async () => {
    const now = new Date("2026-06-25T07:00:00.000Z");
    let insertCalls = 0;

    const result = await runCalendarReminderCron({
      now,
      deps: {
        listEventsInRange: async () => [event({ sendReminders: false })],
        listActiveUserIds: async () => ["olivia-bennett"],
        tryInsertDelivery: async () => {
          insertCalls += 1;
          return null;
        },
      },
    });

    assert.equal(insertCalls, 0);
    assert.equal(result.sent, 0);
    assert.equal(result.skipped, 3);
  });

  it("calls onDelivery after a successful insert", async () => {
    const now = new Date("2026-06-25T07:00:00.000Z");
    const onDeliveryCalls: Array<{
      userId: string;
      offsetMinutes: number;
    }> = [];

    await runCalendarReminderCron({
      now,
      deps: {
        listEventsInRange: async () => [
          event({ scope: "personal", ownerUserId: "olivia-bennett" }),
        ],
        listActiveUserIds: async () => ["olivia-bennett"],
        tryInsertDelivery: async (input) => ({
          id: "delivery-1",
          eventId: input.eventId,
          userId: input.userId,
          offsetMinutes: input.offsetMinutes,
          fireAt: input.fireAt,
          notificationId: null,
          eventUpdatedAt: input.eventUpdatedAt,
          createdAt: now.toISOString(),
        }),
        onDelivery: async ({ delivery, offsetMinutes }) => {
          onDeliveryCalls.push({
            userId: delivery.userId,
            offsetMinutes,
          });
        },
      },
    });

    assert.equal(onDeliveryCalls.length, 2);
    assert.equal(onDeliveryCalls[0]?.userId, "olivia-bennett");
    assert.equal(onDeliveryCalls[0]?.offsetMinutes, 60);
    assert.equal(onDeliveryCalls[1]?.offsetMinutes, 10);
  });

  it("delivers 10-minute reminders to each recipient", async () => {
    const now = new Date("2026-06-25T07:50:00.000Z");
    const onDeliveryCalls: Array<{
      userId: string;
      offsetMinutes: number;
    }> = [];

    const result = await runCalendarReminderCron({
      now,
      deps: {
        listEventsInRange: async () => [
          event({
            scope: "personal",
            ownerUserId: "olivia-bennett",
          }),
        ],
        listActiveUserIds: async () => ["olivia-bennett"],
        tryInsertDelivery: async (input) => ({
          id: `delivery-${input.userId}-${input.offsetMinutes}`,
          eventId: input.eventId,
          userId: input.userId,
          offsetMinutes: input.offsetMinutes,
          fireAt: input.fireAt,
          notificationId: null,
          eventUpdatedAt: input.eventUpdatedAt,
          createdAt: now.toISOString(),
        }),
        onDelivery: async ({ delivery, offsetMinutes }) => {
          onDeliveryCalls.push({
            userId: delivery.userId,
            offsetMinutes,
          });
        },
      },
    });

    assert.equal(result.sent, 2);
    assert.equal(result.skipped, 1);
    assert.deepEqual(onDeliveryCalls, [
      { userId: "olivia-bennett", offsetMinutes: 60 },
      { userId: "olivia-bennett", offsetMinutes: 10 },
    ]);
  });
});
