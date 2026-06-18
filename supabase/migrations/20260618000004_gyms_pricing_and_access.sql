-- Comprehensive pricing/membership/fee + access model (all nullable → "unlisted").
-- Layer 1 (filter/summary) + policy fields + Layer 2 (membership_plans matrix).
-- See docs/research/pricing-model.md.
alter table public.gyms
  add column if not exists enrollment_fee numeric(8,2),
  add column if not exists annual_fee numeric(8,2),
  add column if not exists annual_fee_label text,
  add column if not exists single_class_price numeric(8,2),
  add column if not exists class_packs jsonb,            -- [{count, price}]
  add column if not exists intro_offer text,
  add column if not exists min_commitment_months integer,
  add column if not exists no_contract_option boolean,
  add column if not exists early_termination jsonb,      -- {type, amount, note}
  add column if not exists cancellation_notice_days integer,
  add column if not exists freeze_policy text,
  add column if not exists membership_plans jsonb,        -- [{name, usage, scope, hours, includes, prices:[{term, monthly, paid_total}], notes}]
  add column if not exists student_discount boolean,
  add column if not exists military_discount boolean,
  add column if not exists senior_discount boolean,
  add column if not exists corporate_discount boolean,
  add column if not exists family_plans boolean,
  add column if not exists guest_policy_model text,
  add column if not exists app_required_entry boolean,
  add column if not exists waitlist boolean,
  add column if not exists members_guest_note text,
  add column if not exists pricing_notes text;

alter table public.gyms drop constraint if exists gyms_guest_policy_model_check;
alter table public.gyms add constraint gyms_guest_policy_model_check
  check (guest_policy_model is null or guest_policy_model in
    ('public_day_pass','member_invite_only','members_only_waitlist','hybrid'));
