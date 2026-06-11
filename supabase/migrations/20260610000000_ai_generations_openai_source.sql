-- Migration: Allow 'openai' as a v2_ai_generations.source value
--
-- The AI generation backend is moving from Google Gemini to the OpenAI API.
-- 'gemini' stays in the allowed set so historical audit rows remain valid.

ALTER TABLE v2_ai_generations
  DROP CONSTRAINT IF EXISTS v2_ai_generations_source_check;

ALTER TABLE v2_ai_generations
  ADD CONSTRAINT v2_ai_generations_source_check
  CHECK (source IN ('openai', 'gemini', 'fallback', 'error'));

COMMENT ON COLUMN v2_ai_generations.source IS
  'openai = OpenAI response used, gemini = legacy Gemini response, fallback = no usable LLM result, error = unexpected failure';
