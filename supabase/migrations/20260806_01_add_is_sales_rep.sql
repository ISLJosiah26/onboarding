-- Marks a user as a sales rep, which surfaces the Client Packages tab and lets
-- them sign through to the client onboarding portal.
--
-- Deliberately NOT a new value of `user_profiles.role`. That column is single-
-- valued and NOT NULL, and App.js gates the employee portal on an exact match:
--
--     if (userProfile?.role === ROLE.EMPLOYEE) return <EmployeePortal ... />
--
-- so setting role = 'sales_rep' would drop a rep straight past that check and
-- take away their time off and company resources — and every RLS policy testing
-- get_user_role() = ANY(ARRAY['admin','manager']) would silently exclude them
-- too. Being a sales rep is a capability, orthogonal to the employee → admin →
-- super_admin ladder: a rep may sit anywhere on it.
--
-- Additive and reversible. Defaults to false, so no existing user's access
-- changes and no existing policy needs revisiting.

alter table public.user_profiles
  add column if not exists is_sales_rep boolean not null default false;

comment on column public.user_profiles.is_sales_rep is
  'Capability flag, independent of role. Grants the Client Packages tab and '
  'single sign-on into the client onboarding portal. Source of truth for who '
  'may act as ISL staff in that portal.';

-- Only a super admin may grant the capability. `Admins can update profiles`
-- already exists for role changes; this adds no new write path, since column-
-- level grants are not used here — it is a reminder that the existing
-- super_admin_update_profiles policy governs this column too.

-- Partial index: the flagged set stays small, so lookups skip the rest.
create index if not exists user_profiles_sales_rep_idx
  on public.user_profiles (id) where is_sales_rep;
