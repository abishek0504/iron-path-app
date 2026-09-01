ALTER TABLE public.v2_exercises
  ADD COLUMN IF NOT EXISTS demo_video_url text;

COMMENT ON COLUMN public.v2_exercises.demo_video_url IS
  'Optional hosted demo clip URL. Null until a clip is curated.';
