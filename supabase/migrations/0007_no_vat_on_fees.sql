-- =====================================================================
-- No VAT on Brighttemp booking fees.
--
-- The flat fee is charged without VAT, so invoices are raised at the fee
-- amount with nothing added. The VAT machinery stays in place: if
-- Brighttemp registers for VAT later, set vat_registered back to true and
-- vat_rate to the rate, and new invoices pick it up with no code change.
-- =====================================================================

update public.platform_settings set value = 'false', updated_at = now()
 where key = 'vat_registered';
update public.platform_settings set value = '0', updated_at = now()
 where key = 'vat_rate';

update public.platform_settings
   set description = 'Whether Brighttemp charges VAT on its booking fee. False = the flat fee is the whole amount.'
 where key = 'vat_registered';

alter table public.invoices alter column vat_rate set default 0;

-- ---------------------------------------------------------------------
-- Honour vat_registered, not just the rate.
--
-- Previously this read vat_rate alone, so a stray rate would have added
-- VAT even with registration switched off. Now registration decides, and
-- the rate only applies when it is on.
-- ---------------------------------------------------------------------

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

    select coalesce(p.payment_terms_days, 14) into v_terms
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
-- Drafts only: these have not been sent to anyone, so re-stating them is
-- safe. Invoices already sent or paid keep what the practice received —
-- changing an issued invoice after the fact is not something to automate.
-- ---------------------------------------------------------------------

update public.invoices
   set vat_rate = 0, vat_amount = 0
 where status = 'draft'
   and vat_amount <> 0;
