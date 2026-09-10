/**
 * Edge Function: Generate Week (AI Coach)
 */
import { handleGenerateWeek } from './handler.ts';

Deno.serve(handleGenerateWeek);
