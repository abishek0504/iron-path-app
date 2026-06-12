/**
 * Edge Function: generate-exercise-image
 *
 * Generates a single anatomical exercise illustration via OpenAI Images API.
 * Uses OPENAI_API_KEY from Supabase secrets (same as generate-workout).
 *
 * Request body: { prompt: string, size?: string }
 * Response: { image_base64: string }
 */

const DEFAULT_SIZE = '1536x1024';
const MODEL = Deno.env.get('OPENAI_IMAGE_MODEL') || 'gpt-image-1';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return jsonResponse({ error: 'OPENAI_API_KEY not configured' }, 500);
  }

  let body: { prompt?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 4000) {
    return jsonResponse({ error: 'prompt required (max 4000 chars)' }, 400);
  }

  const size = typeof body.size === 'string' ? body.size : DEFAULT_SIZE;

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size,
      quality: 'medium',
      output_format: 'jpeg',
      n: 1,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return jsonResponse(
      { error: `OpenAI HTTP ${response.status}`, detail: text.slice(0, 300) },
      502,
    );
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string') {
    return jsonResponse({ error: 'No image in OpenAI response' }, 502);
  }

  return jsonResponse({ image_base64: b64, model: MODEL }, 200);
});
