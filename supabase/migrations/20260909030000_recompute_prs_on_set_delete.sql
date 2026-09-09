-- Recompute the next-best PR when a completed set is deleted (session/set delete).

CREATE OR REPLACE FUNCTION public.recompute_user_exercise_pr(
  p_user_id uuid,
  p_exercise_id uuid,
  p_custom_exercise_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  best record;
BEGIN
  DELETE FROM public.v2_user_exercise_prs
  WHERE user_id = p_user_id
    AND (
      (p_exercise_id IS NOT NULL AND exercise_id = p_exercise_id)
      OR (p_custom_exercise_id IS NOT NULL AND custom_exercise_id = p_custom_exercise_id)
    );

  SELECT
    ss.id AS set_id,
    ss.weight,
    ss.reps,
    ss.performed_at,
    se.id AS session_exercise_id,
    se.session_id,
    se.exercise_id,
    se.custom_exercise_id
  INTO best
  FROM public.v2_session_sets ss
  JOIN public.v2_session_exercises se ON se.id = ss.session_exercise_id
  JOIN public.v2_workout_sessions ws ON ws.id = se.session_id
  WHERE ws.user_id = p_user_id
    AND ss.performed_at IS NOT NULL
    AND ss.weight IS NOT NULL
    AND (
      (p_exercise_id IS NOT NULL AND se.exercise_id = p_exercise_id)
      OR (p_custom_exercise_id IS NOT NULL AND se.custom_exercise_id = p_custom_exercise_id)
    )
  ORDER BY ss.weight DESC, COALESCE(ss.reps, 0) DESC, ss.performed_at DESC
  LIMIT 1;

  IF best.set_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.v2_user_exercise_prs (
    user_id, exercise_id, custom_exercise_id, weight, reps,
    set_id, session_exercise_id, session_id, performed_at
  ) VALUES (
    p_user_id, best.exercise_id, best.custom_exercise_id, best.weight, best.reps,
    best.set_id, best.session_exercise_id, best.session_id, best.performed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_user_exercise_pr(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_recompute_pr_after_set_delete() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_recompute_pr_after_set_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_exercise_id uuid;
  v_custom_exercise_id uuid;
BEGIN
  SELECT ws.user_id, se.exercise_id, se.custom_exercise_id
  INTO v_user_id, v_exercise_id, v_custom_exercise_id
  FROM public.v2_session_exercises se
  JOIN public.v2_workout_sessions ws ON ws.id = se.session_id
  WHERE se.id = OLD.session_exercise_id;

  IF v_user_id IS NOT NULL THEN
    PERFORM public.recompute_user_exercise_pr(v_user_id, v_exercise_id, v_custom_exercise_id);
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_session_set_pr_recompute ON public.v2_session_sets;
CREATE TRIGGER trg_session_set_pr_recompute
  AFTER DELETE ON public.v2_session_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recompute_pr_after_set_delete();
