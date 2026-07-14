-- Atomic approve/deny/cancel for time-off requests. Each updates the request
-- status and the employee's balance in a single transaction with an internal
-- role/ownership check. Mirrors the migration applied on 2026-07-14.

CREATE OR REPLACE FUNCTION public.approve_time_off_request(p_request_id uuid, p_notes text DEFAULT NULL)
 RETURNS public.time_off_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_req time_off_requests;
BEGIN
  IF get_user_role() NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req FROM time_off_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status = 'approved' THEN RETURN v_req; END IF;

  UPDATE time_off_requests
     SET status = 'approved', review_notes = p_notes, reviewed_at = now(), updated_at = now()
   WHERE id = p_request_id RETURNING * INTO v_req;

  INSERT INTO time_off_balances (employee_id, year, total_days, used_days)
  VALUES (v_req.employee_id, extract(year from v_req.start_date)::int, 0, v_req.business_days)
  ON CONFLICT (employee_id, year)
  DO UPDATE SET used_days = time_off_balances.used_days + EXCLUDED.used_days, updated_at = now();

  RETURN v_req;
END;
$function$;

CREATE OR REPLACE FUNCTION public.deny_time_off_request(p_request_id uuid, p_notes text DEFAULT NULL)
 RETURNS public.time_off_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_req time_off_requests; v_was_approved boolean;
BEGIN
  IF get_user_role() NOT IN ('admin','super_admin') THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req FROM time_off_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  v_was_approved := v_req.status = 'approved';

  UPDATE time_off_requests
     SET status = 'denied', review_notes = p_notes, reviewed_at = now(), updated_at = now()
   WHERE id = p_request_id RETURNING * INTO v_req;

  IF v_was_approved THEN
    UPDATE time_off_balances
       SET used_days = greatest(0, used_days - v_req.business_days), updated_at = now()
     WHERE employee_id = v_req.employee_id AND year = extract(year from v_req.start_date)::int;
  END IF;

  RETURN v_req;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_time_off_request(p_request_id uuid)
 RETURNS public.time_off_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_req time_off_requests; v_caller_employee uuid; v_is_admin boolean; v_was_approved boolean;
BEGIN
  v_is_admin := get_user_role() IN ('admin','super_admin');
  SELECT employee_id INTO v_caller_employee FROM user_profiles WHERE id = auth.uid();

  SELECT * INTO v_req FROM time_off_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF NOT v_is_admin AND v_req.employee_id IS DISTINCT FROM v_caller_employee THEN
    RAISE EXCEPTION 'Access denied' USING errcode = '42501';
  END IF;
  IF v_req.status NOT IN ('pending','approved') THEN RETURN v_req; END IF;

  v_was_approved := v_req.status = 'approved';

  UPDATE time_off_requests SET status = 'cancelled', updated_at = now()
   WHERE id = p_request_id RETURNING * INTO v_req;

  IF v_was_approved THEN
    UPDATE time_off_balances
       SET used_days = greatest(0, used_days - v_req.business_days), updated_at = now()
     WHERE employee_id = v_req.employee_id AND year = extract(year from v_req.start_date)::int;
  END IF;

  RETURN v_req;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.approve_time_off_request(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.deny_time_off_request(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_time_off_request(uuid) FROM anon;
