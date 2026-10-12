import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const TRANSCRIBE_MODEL = 'gpt-4o-transcribe';
const MAX_BYTES = 2 * 1024 * 1024;
// Vocabulary hint -- the model spells dish names and units the way it saw
// them here instead of guessing ("idly", "4 grams" for "katori", ...).
const PROMPT =
  'Meal description. Indian foods like idli, dosa, paneer, roti, chapati, dal, sambar, biryani, katori; quantities in grams.';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let audio: FormDataEntryValue | null;
  try {
    audio = (await req.formData()).get('audio');
  } catch {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }
  if (!(audio instanceof File) || audio.size === 0) {
    return json({ error: 'Missing audio file' }, 400);
  }
  if (audio.size > MAX_BYTES) {
    return json({ error: 'Audio too large' }, 400);
  }

  const upstream = new FormData();
  upstream.append('file', audio, audio.name || 'voice.webm');
  upstream.append('model', TRANSCRIBE_MODEL);
  upstream.append('language', 'en');
  upstream.append('prompt', PROMPT);

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      body: upstream,
    });
    if (!res.ok) {
      console.error('OpenAI transcription failed', res.status, await res.text());
      return json({ error: 'Transcription failed' }, 502);
    }

    const data = await res.json();
    return json({ text: String(data.text ?? '').trim() });
  } catch (err) {
    console.error('OpenAI transcription request failed', err);
    return json({ error: 'Transcription failed' }, 502);
  }
});
