-- =====================================================================
-- Payment terms: 14 days from issue, down to 7.
--
-- The number lives in three places and all three have to move together,
-- or a practice registering tomorrow gets 14 again:
--
--   practices.payment_terms_days  — the real one. Read per practice when
--                                   a confirmed booking raises its
--                                   invoice.
--   its column default            — what a new practice is given at
--                                   registration.
--   platform_settings             — not read by anything today, but it
--                                   describes the house default and
--                                   would mislead whoever reads it next.
-- =====================================================================

-- 1. New practices.
alter table public.practices
  alter column payment_terms_days set default 7;

-- 2. Practices already on the books.
--    Only the ones still on the old default. If a practice was put on
--    different terms deliberately — a group on 30 days, say — that was a
--    decision about that practice and this migration has no business
--    undoing it.
update public.practices
   set payment_terms_days = 7
 where payment_terms_days = 14;

-- 3. The stated house default.
update public.platform_settings
   set value = '7', updated_at = now()
 where key = 'invoice_payment_terms_days';

-- 4. The fallback inside the invoice trigger. payment_terms_days is NOT
--    NULL so the coalesce never actually fires, but leaving a 14 in there
--    is a trap for the next person reading it. Recreated whole rather
--    than patched, so this file is the current definition.
create or replace function public.invoice_on_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_registered boolean;
  v_vat_rate numeric;
  v_terms int;
  v_subtotal numeric;
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    select coalesce((value)::text::boolean, false) into v_registered
      from public.platform_settings where key = 'vat_registered';

    if coalesce(v_registered, false) then
      select (value)::text::numeric into v_vat_rate
        from public.platform_settings where key = 'vat_rate';
    end if;
    v_vat_rate := coalesce(v_vat_rate, 0);

    select coalesce(p.payment_terms_days, 7) into v_terms
      from public.practices p where p.id = new.practice_id;

    v_subtotal := new.booking_fee + new.same_day_surcharge;

    insert into public.invoices
      (practice_id, booking_id, issue_date, due_date, subtotal, vat_rate, vat_amount, status)
    values
      (new.practice_id, new.id, current_date, current_date + v_terms,
       v_subtotal, v_vat_rate, round(v_subtotal * v_vat_rate, 2), 'draft')
    on conflict do nothing;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 5. Invoices already raised.
--
--    Drafts only, following 0007: a draft has not been sent to anyone,
--    so restating it is safe, and leaving a draft on terms the practice
--    is no longer on would go out wrong. An invoice already sent or paid
--    keeps the due date the practice received — moving a date somebody
--    has in their accounts payable is not something to automate.
-- ---------------------------------------------------------------------
update public.invoices i
   set due_date = i.issue_date + p.payment_terms_days
  from public.practices p
 where p.id = i.practice_id
   and i.status = 'draft'
   and i.due_date <> i.issue_date + p.payment_terms_days;
