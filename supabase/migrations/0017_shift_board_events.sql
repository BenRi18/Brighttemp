-- =====================================================================
-- Notification events for the shift board.
--
-- On its own because Postgres will not let a new enum value be USED in
-- the same transaction that adds it — the same reason 0005 exists on its
-- own for 'photo_id'. 0018 and 0019 do the rest.
-- =====================================================================

alter type public.notification_event add value if not exists 'shift_posted';
alter type public.notification_event add value if not exists 'shift_claimed';
alter type public.notification_event add value if not exists 'shift_filled';
