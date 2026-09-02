-- Allow 10-minute calendar reminder offsets (app uses 1440, 60, 10).

alter table calendar_reminder_deliveries
  drop constraint if exists calendar_reminder_deliveries_offset_minutes_check;

alter table calendar_reminder_deliveries
  add constraint calendar_reminder_deliveries_offset_minutes_check
  check (offset_minutes in (1440, 60, 10));
