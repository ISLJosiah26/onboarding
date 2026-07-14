-- Pin search_path on flagged functions and add role guards to privileged RPCs.
-- Mirrors the migration applied to the ISL-onboarding project on 2026-07-14.

CREATE OR REPLACE FUNCTION public.create_onboarding(p_full_name text, p_email text, p_role_id uuid, p_hire_date date, p_brand text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_employee_id uuid;
  v_instance_id uuid;
begin
  if get_user_role() not in ('admin','super_admin') then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  insert into employees (full_name, email, role_id, hire_date, brand)
  values (p_full_name, p_email, p_role_id, p_hire_date, p_brand)
  returning id into v_employee_id;

  insert into onboarding_instances (employee_id)
  values (v_employee_id)
  returning id into v_instance_id;

  insert into task_completions (instance_id, template_task_id, completed, day, sort_order)
  select v_instance_id, t.id, false, t.phase, coalesce(t.sort_order, 0)
  from onboarding_templates t
  where t.role_id = p_role_id;

  return json_build_object('employee_id', v_employee_id, 'instance_id', v_instance_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.swap_employee_and_tasks(p_employee_id uuid, p_full_name text, p_email text, p_hire_date date, p_role_id uuid, p_manager_id uuid, p_instance_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF get_user_role() NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;

  UPDATE employees
  SET full_name = p_full_name, email = p_email, hire_date = p_hire_date,
      role_id = p_role_id, manager_id = p_manager_id
  WHERE id = p_employee_id;

  IF p_instance_id IS NOT NULL THEN
    DELETE FROM task_completions WHERE instance_id = p_instance_id;
    INSERT INTO task_completions (instance_id, template_task_id, completed, day, sort_order)
    SELECT p_instance_id, t.id, false, t.phase, coalesce(t.sort_order, 0)
    FROM onboarding_templates t WHERE t.role_id = p_role_id;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ select role from user_profiles where id = auth.uid(); $function$;

CREATE OR REPLACE FUNCTION public.calculate_business_days(p_start date, p_end date)
 RETURNS numeric LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  select count(*)::numeric
  from generate_series(p_start + interval '1 day', p_end, interval '1 day') as d
  where extract(dow from d) not in (0, 6)
    and not exists (
      select 1 from company_holidays h
      where h.date = d::date
         or (h.repeats_yearly
             and extract(month from h.date) = extract(month from d)
             and extract(day from h.date) = extract(day from d)))
$function$;

CREATE OR REPLACE FUNCTION public.trg_set_business_days()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
begin
  if new.is_half_day then new.business_days := 0.5;
  else new.business_days := calculate_business_days(new.start_date, new.end_date);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$ begin new.updated_at = now(); return new; end; $function$;

CREATE OR REPLACE FUNCTION public.rollover_time_off_balances(from_year integer, to_year integer, carry_over_cap numeric DEFAULT 0)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
begin
  insert into time_off_balances (employee_id, year, total_days, used_days)
  select b.employee_id, to_year, greatest(least(b.total_days - b.used_days, carry_over_cap), 0), 0
  from time_off_balances b where b.year = from_year
  on conflict (employee_id, year) do nothing;
end;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_onboarding(text, text, uuid, date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.swap_employee_and_tasks(uuid, text, text, date, uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_all_users_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_audit_log(text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rollover_time_off_balances(integer, integer, numeric) FROM anon, authenticated;
