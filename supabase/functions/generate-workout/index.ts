/**
 * Edge Function: Generate Workout (OpenAI-powered)
 */
import { handleGenerateWorkout } from './handler.ts';

Deno.serve(handleGenerateWorkout);
