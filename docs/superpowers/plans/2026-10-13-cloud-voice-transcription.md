# Cloud Voice Transcription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Chat's Android on-device speech recognizer with record-until-stop audio that a Supabase edge function transcribes through OpenAI, so pauses can no longer cut dictation off.

**Architecture:** The WebView records with `MediaRecorder` inside a new `useVoiceRecorder` hook. On stop, the clip is posted as multipart to a new `transcribe` edge function, which forwards it to OpenAI `/v1/audio/transcriptions` and returns `{ text }`; `ChatMealLog` appends that text to its message box. The old speech-recognition plugin, its patch and `patch-package` are removed.

**Tech Stack:** React 18 + TypeScript (Vite), Capacitor 7 Android WebView, Supabase Edge Functions (Deno, `serve` from deno std 0.168.0), OpenAI audio transcriptions API.

**Spec:** `docs/superpowers/specs/2026-10-12-cloud-voice-transcription-design.md`

## Global Constraints

- Transcription model: `TRANSCRIBE_MODEL = 'gpt-4o-transcribe'`, `language: 'en'`.
- Prompt sent to OpenAI: `'Meal description. Indian foods like idli, dosa, paneer, roti, chapati, dal, sambar, biryani, katori; quantities in grams.'`
- Edge function rejects audio over 2 MB (`2 * 1024 * 1024` bytes) with 400.
- Recording auto-stops at `MAX_SECONDS = 120`; recordings under 500 ms are discarded without a request.
- Toast copy: `Microphone permission needed` (destructive), `Didn't catch anything`, `Couldn't transcribe — try again or type it` (destructive).
- Status line copy: `Recording m:ss` while recording, `Transcribing…` while transcribing.
- JWT verification stays on for `transcribe` (no `supabase/config.toml` entry).
- No migrations, so `src/integrations/supabase/types.ts` is not regenerated.
- `npm run typecheck` and `npm run lint` must finish with 0 errors (warnings allowed).
- The working tree has unrelated uncommitted user edits in `src/components/AddFoodForm.tsx`, `src/pages/AddMeal.tsx` and `src/services/foodService.ts`. Never stage or modify them: always `git add` explicit paths, never `git add -A` / `git add .`.
- Commit, push and merge steps run only after the user says so (standing rule). Commit steps below are where to commit once they do.
- Every change is verified on the adb-connected Android phone (`adb devices` shows `R9ZYA00X9HW`). Test data created there is deleted afterwards.
- The repo has no unit-test runner. Verification is typecheck, lint, `curl` for the edge function's auth gate, and on-device behavior read via screenshots plus `adb logcat`.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/functions/transcribe/index.ts` (create) | Accept one audio file, forward to OpenAI, return `{ text }` |
| `src/hooks/useVoiceRecorder.ts` (create) | Mic capture, timer, 120s cap, upload, toasts; exposes `{ state, seconds, toggle }` |
| `src/components/ChatMealLog.tsx` (modify) | Drop all speech-recognition code; wire the hook into the composer |
| `package.json`, `package-lock.json` (modify) | Remove `@capacitor-community/speech-recognition`, `patch-package`, `postinstall` |
| `patches/` (delete) | Old plugin patch |

## Build-and-install command (used by several tasks)

```bash
cd /d/Projects/bite_balance-main/bite_balance-main && npm run build && npx cap sync android && (cd android && ./gradlew installDebug)
```

Expected: ends with `BUILD SUCCESSFUL`.

---

### Task 1: Spike — does `MediaRecorder` work in the Capacitor WebView? (throwaway)

**Files:**
- Modify temporarily: `src/components/ChatMealLog.tsx` (`handleMicToggle`), reverted at the end of this task

**Interfaces:** none. Nothing from this task survives.

- [ ] **Step 1: Temporarily replace the body of `handleMicToggle`**

Replace the whole `const handleMicToggle = async () => { ... };` function with:

```tsx
  const handleMicToggle = async () => {
    // SPIKE -- throwaway, reverted in Task 1 step 5
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType });
        console.log(`SPIKE ok mime=${rec.mimeType} bytes=${blob.size}`);
      };
      rec.start();
      setTimeout(() => rec.stop(), 3000);
    } catch (err) {
      console.log(`SPIKE fail ${err instanceof Error ? err.name + ': ' + err.message : String(err)}`);
    }
  };
```

- [ ] **Step 2: Build and install** (see "Build-and-install command"). Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Run it on the phone**

```bash
adb logcat -c
adb shell am force-stop com.bite_balance.app
adb shell monkey -p com.bite_balance.app 1
```

Open Chat (bottom nav "Chat", around x=227 y=1420 on the 720x1600 screen) and tap the mic (around x=567 y=1283). Accept an Android microphone prompt if one appears. Wait 5 s, then:

```bash
adb logcat -d | grep SPIKE
```

Expected: `SPIKE ok mime=audio/webm;codecs=opus bytes=<several thousand>`. Any `mime` value is fine as long as `bytes` > 1000.

- [ ] **Step 4: Decide**

- `SPIKE ok` with bytes > 1000 → continue.
- `SPIKE fail` (e.g. `NotAllowedError`, `NotSupportedError`) or bytes ≤ 1000 → **stop the plan** and report the log line to the user. Approach B (native recorder plugin) needs its own design approval.

- [ ] **Step 5: Revert the spike**

```bash
git checkout -- src/components/ChatMealLog.tsx
git diff --stat src/components/ChatMealLog.tsx
```

Expected: no diff output for that file.

---

### Task 2: `transcribe` edge function

**Files:**
- Create: `supabase/functions/transcribe/index.ts`

**Interfaces:**
- Produces: `POST /functions/v1/transcribe`, `multipart/form-data` with field `audio` (File). Responses: `200 { text: string }`, `400 { error: string }`, `502 { error: string }`. Requires a user JWT (gateway-enforced).

- [ ] **Step 1: Write the function**

```ts
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
});
```

- [ ] **Step 2: Deploy**

Use the Supabase MCP `deploy_edge_function` tool with `project_id: "ppbckzgqevfpkhymwuxs"`, `name: "transcribe"`, `entrypoint_path: "index.ts"`, `verify_jwt: true`, and `files: [{ name: "index.ts", content: <the file above> }]`.

Expected: the result lists `transcribe` with status `ACTIVE`.

- [ ] **Step 3: Verify the auth gate**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://ppbckzgqevfpkhymwuxs.supabase.co/functions/v1/transcribe
```

Expected: `401`, meaning the gateway rejects calls without a user JWT. The 200 path is verified from the phone in Task 3, using the signed-in app session. The publishable key is not a JWT, and the agent must not sign in as the user, so curl can't exercise it.

- [ ] **Step 4: Commit** (after the user's go-ahead)

```bash
git add supabase/functions/transcribe/index.ts
git commit -m "Add transcribe edge function for cloud voice input"
```

---

### Task 3: `useVoiceRecorder` hook wired into Chat

**Files:**
- Create: `src/hooks/useVoiceRecorder.ts`
- Modify: `src/components/ChatMealLog.tsx`. The line numbers are from the current file; match on the code shown, not the numbers.

**Interfaces:**
- Consumes: the `transcribe` function from Task 2, via `supabase.functions.invoke('transcribe', { body: FormData })` → `{ data: { text: string } | null, error }`.
- Produces: `useVoiceRecorder(onTranscript: (text: string) => void): { state: VoiceState; seconds: number; toggle: () => Promise<void> }`, with `export type VoiceState = 'idle' | 'recording' | 'transcribing'`.

- [ ] **Step 1: Create the hook**

`src/hooks/useVoiceRecorder.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type VoiceState = 'idle' | 'recording' | 'transcribing';

const MAX_SECONDS = 120;
const MIN_MS = 500;

const extFor = (mime: string) =>
  mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';

// Records until toggled off (or MAX_SECONDS), then sends the clip to the
// `transcribe` edge function. No pause detection anywhere -- that's the
// point: Android's on-device recognizer cut dictation off at every breath.
export function useVoiceRecorder(onTranscript: (text: string) => void) {
  const { toast } = useToast();
  const [state, setState] = useState<VoiceState>('idle');
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const discardRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  useEffect(() => {
    if (state !== 'recording') return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (seconds >= MAX_SECONDS) stop();
  }, [seconds, stop]);

  // Leaving the screen mid-recording releases the mic and sends nothing.
  useEffect(
    () => () => {
      discardRef.current = true;
      stop();
    },
    [stop]
  );

  const transcribe = async (blob: Blob) => {
    setState('transcribing');
    try {
      const form = new FormData();
      form.append('audio', blob, `voice.${extFor(blob.type)}`);
      const { data, error } = await supabase.functions.invoke('transcribe', { body: form });
      if (error) throw error;
      const text = String(data?.text ?? '').trim();
      if (text) onTranscriptRef.current(text);
      else toast({ title: "Didn't catch anything" });
    } catch (err) {
      console.error('Transcription error:', err);
      toast({ title: "Couldn't transcribe — try again or type it", variant: 'destructive' });
    } finally {
      setState('idle');
    }
  };

  const toggle = async () => {
    if (state === 'recording') {
      stop();
      return;
    }
    if (state !== 'idle') return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('getUserMedia error:', err);
      toast({
        title: 'Microphone permission needed',
        description: 'Allow microphone access to use voice input.',
        variant: 'destructive',
      });
      return;
    }

    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    discardRef.current = false;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorderRef.current = null;
      setSeconds(0);
      if (discardRef.current || Date.now() - startedAt < MIN_MS) {
        setState('idle');
        return;
      }
      void transcribe(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setState('recording');
  };

  return { state, seconds, toggle };
}
```

- [ ] **Step 2: Strip the old speech code from `ChatMealLog.tsx`**

Delete exactly these, leaving everything else as it is:
1. Line 4: `import { SpeechRecognition } from '@capacitor-community/speech-recognition';`
2. Line 39: `const MAX_FAILED_RESTARTS = 10;`
3. Line 140: `const [listening, setListening] = useState(false);`
4. Between `const bottomRef = useRef<HTMLDivElement>(null);` and the `useEffect` that calls `bottomRef.current?.scrollIntoView(...)`, delete every comment and every `useRef` declaration: `dictatingRef`, `draftRef`, `committedTextRef`, `ignorePartialRef`, `lastSpeechEventRef`, `restartPendingRef`, `failedRestartsRef`.
5. The effect `useEffect(() => { draftRef.current = draft; }, [draft]);`
6. The effect that starts with `const partialHandle = SpeechRecognition.addListener('partialResults'` and ends with `}, [toast]);`.
7. The watchdog: its comment block starting `// Watchdog:`, and the effect starting `if (!listening) return;` and ending `}, [listening, toast]);`.
8. The whole `const handleMicToggle = async () => { ... };` function.

Then check that nothing is left behind:

```bash
cd /d/Projects/bite_balance-main/bite_balance-main && grep -nE "SpeechRecognition|listening|setListening|dictatingRef|draftRef|committedTextRef|ignorePartialRef|lastSpeechEventRef|restartPendingRef|failedRestartsRef|MAX_FAILED_RESTARTS|handleMicToggle" src/components/ChatMealLog.tsx
```

Expected: matches only in the composer JSX (`{listening && (`, `onClick={handleMicToggle}`, `aria-label={listening ...`, `listening && 'animate-pulse ...'`). Step 4 replaces them.

- [ ] **Step 3: Add the hook call**

Add the import next to the other `@/hooks` imports:

```tsx
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
```

Directly after `const bottomRef = useRef<HTMLDivElement>(null);`, add:

```tsx
  // Each transcript is appended to whatever is already typed, so the user can
  // dictate in several goes and still edit before sending.
  const voice = useVoiceRecorder((text) =>
    setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text))
  );
  const voiceClock = `${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, '0')}`;
```

- [ ] **Step 4: Rewire the composer JSX**

Replace:

```tsx
          {listening && (
            <div className="flex items-center gap-1.5 px-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
              <span className="text-[11px] font-medium text-destructive">Listening…</span>
            </div>
          )}
```

with:

```tsx
          {voice.state !== 'idle' && (
            <div className="flex items-center gap-1.5 px-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
              <span className="text-[11px] font-medium text-destructive">
                {voice.state === 'recording' ? `Recording ${voiceClock}` : 'Transcribing…'}
              </span>
            </div>
          )}
```

Replace the mic `<button>`:

```tsx
            <button
              type="button"
              onClick={handleMicToggle}
              disabled={sending}
              aria-label={listening ? 'Stop dictation' : 'Dictate'}
              className={cn(
                'flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-muted-foreground disabled:opacity-50',
                listening && 'animate-pulse bg-primary/10 text-primary'
              )}
            >
              <Mic className="h-4 w-4" />
            </button>
```

with:

```tsx
            <button
              type="button"
              onClick={() => void voice.toggle()}
              disabled={sending || voice.state === 'transcribing'}
              aria-label={voice.state === 'recording' ? 'Stop recording' : 'Record voice'}
              className={cn(
                'flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-muted-foreground disabled:opacity-50',
                voice.state === 'recording' && 'animate-pulse bg-primary/10 text-primary'
              )}
            >
              {voice.state === 'transcribing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
```

(`Loader2`, `Mic` and `cn` are already imported.)

- [ ] **Step 5: Typecheck and lint**

```bash
cd /d/Projects/bite_balance-main/bite_balance-main && npm run typecheck && npm run lint
```

Expected: typecheck passes with no output after the `tsc` lines; lint ends `(0 errors, N warnings)`.

- [ ] **Step 6: Build, install, and run the core on-device check**

Run the "Build-and-install command", then:

```bash
adb logcat -c
```

Ask the user to open Chat, tap the mic, say "two eggs and toast", pause 3 s or more, say "with butter and a banana", then tap the mic again, and **not** send. Take a screenshot:

```bash
adb exec-out screencap -p > /tmp/voice1.png
```

Read `/tmp/voice1.png`. Expected: the message box contains both phrases, e.g. "Two eggs and toast with butter and a banana". If it's wrong, look at the logs:

```bash
adb logcat -d | grep -iE "Transcription error|getUserMedia error|Capacitor/Console" | tail -20
```

and the function logs (Supabase MCP `get_logs`, service `edge-function`).

- [ ] **Step 7: Commit** (after the user's go-ahead)

```bash
git add src/hooks/useVoiceRecorder.ts src/components/ChatMealLog.tsx
git commit -m "Record voice and transcribe in the cloud instead of Android's recognizer"
```

---

### Task 4: Remove the old recognizer and run the full device checks

**Files:**
- Modify: `package.json`, `package-lock.json`
- Delete: `patches/@capacitor-community+speech-recognition+7.0.1.patch` (the whole `patches/` directory)

**Interfaces:**
- Consumes: Task 3's `ChatMealLog.tsx`, which no longer imports the plugin.

- [ ] **Step 1: Confirm nothing else uses the plugin**

```bash
cd /d/Projects/bite_balance-main/bite_balance-main && grep -rn "speech-recognition\|SpeechRecognition" src
```

Expected: no output.

- [ ] **Step 2: Uninstall and delete**

```bash
cd /d/Projects/bite_balance-main/bite_balance-main && npm uninstall @capacitor-community/speech-recognition patch-package && npm pkg delete scripts.postinstall && rm -r patches
```

Expected: `package.json` no longer contains `speech-recognition`, `patch-package` or `postinstall`:

```bash
grep -nE "speech-recognition|patch-package|postinstall" package.json
```

Expected: no output.

- [ ] **Step 3: Typecheck, lint, build, sync, install**

```bash
cd /d/Projects/bite_balance-main/bite_balance-main && npm run typecheck && npm run lint
```

Expected: 0 errors. Then run the "Build-and-install command". Expected: `BUILD SUCCESSFUL`, and the plugin is gone from the Android project:

```bash
grep -n "speech-recognition" android/capacitor.settings.gradle android/app/capacitor.build.gradle
```

Expected: no output.

- [ ] **Step 4: Full on-device checks**

Run each one, then screenshot with `adb exec-out screencap -p > /tmp/<name>.png` and read the image:

1. **Pause test:** repeat Task 3 step 6. Expected: the full sentence is in the box.
2. **Append:** with that text still in the box, record "and a glass of milk". Expected: it's appended after a space.
3. **Permission denied:**
   ```bash
   adb shell pm revoke com.bite_balance.app android.permission.RECORD_AUDIO
   ```
   Tap the mic and deny the prompt. Expected: the "Microphone permission needed" toast. Then restore the permission:
   ```bash
   adb shell pm grant com.bite_balance.app android.permission.RECORD_AUDIO
   ```
4. **Offline:** ask the user to switch on airplane mode, record 2 s and stop. Expected: the "Couldn't transcribe — try again or type it" toast, and the box is unchanged. Ask them to switch airplane mode off.
5. **Leave mid-recording:** start recording, then tap "Today" in the bottom nav. Expected: the green mic privacy dot in the status bar disappears within about 2 s.
6. **Accidental tap:** tap the mic twice quickly (under 0.5 s). Expected: no "Transcribing…", no toast.

- [ ] **Step 5: Restore test data**

Using Supabase MCP `execute_sql` on `ppbckzgqevfpkhymwuxs`, list the rows created during testing:

```sql
select id, role, left(content, 60) as content, created_at from chat_messages where created_at > now() - interval '2 hours' order by created_at;
```

Show them to the user, then delete only the rows they confirm are test rows, by id:

```sql
delete from chat_messages where id in ('<id1>', '<id2>') returning id;
```

If the user logged any meals during testing, list and delete the matching `daily_meals` rows the same way, with confirmation.

- [ ] **Step 6: Commit** (after the user's go-ahead)

```bash
git add package.json package-lock.json patches
git commit -m "Remove the on-device speech recognizer, its patch and patch-package"
```

(`git add patches` stages the deletion.)

- [ ] **Step 7: Push and open a PR** (only when the user asks)

```bash
git push -u origin cloud-voice-transcription
gh pr create --base main --head cloud-voice-transcription --title "Cloud voice transcription for Chat" --body "<summary of the four tasks, the on-device results, and: 🤖 Generated with [Claude Code](https://claude.com/claude-code)>"
```
