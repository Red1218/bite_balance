# Cloud voice transcription — Design

## Goal

Replace Chat's voice input (Android's on-device `SpeechRecognizer` via `@capacitor-community/speech-recognition`) with record-then-transcribe: the app records audio until the user taps stop, a Supabase edge function sends it to OpenAI's transcription API, and the text lands in Chat's message box for the user to check before sending.

## Why

Android's recognizer ends its session at every pause in speech and, on the test phone (Samsung SM-E066B), ignores the silence-length extras once speech has started. PR #13 patched the plugin and added restart/dedupe/watchdog logic; that cut the damage to a ~1s dead gap after each pause, but dictation still breaks mid-sentence. Recording the whole clip removes pause detection from the picture entirely.

## Decisions (from brainstorming)

- **Text after stop, not live.** No words appear while speaking; a recording timer shows instead.
- **Fill the box, don't auto-send.** The transcript is appended to the message box; the user reviews and taps send.
- **No fallback.** The old recognizer, its patch and `patch-package` are removed. Chat's AI parsing needs internet anyway.
- **Approach A:** WebView `MediaRecorder` + new `transcribe` edge function. Approach B (native recorder plugin) is used only if the step-1 spike shows `getUserMedia` doesn't work in the Capacitor WebView. Calling OpenAI from the app directly is rejected (would ship the API key in the APK).

## Context: what exists today

- `ChatMealLog.tsx` holds ~150 lines of speech code: the `SpeechRecognition` import, `listening`/`dictatingRef`/`draftRef`/`committedTextRef`/`ignorePartialRef`/`lastSpeechEventRef`/`restartPendingRef`/`failedRestartsRef`, two listener effects, a watchdog effect, `handleMicToggle`, and `MAX_FAILED_RESTARTS`.
- `patches/@capacitor-community+speech-recognition+7.0.1.patch`, `patch-package` devDependency, `"postinstall": "patch-package"` in `package.json`.
- Edge functions (`chat-meal`, `parse-meal`) use `serve` from deno std, a `corsHeaders` object, and plain `fetch` to `https://api.openai.com/v1/...` with `Deno.env.get('OPENAI_API_KEY')`. JWT verification is on by default (only `search-food` disables it in `supabase/config.toml`).
- `AndroidManifest.xml` already declares `RECORD_AUDIO`.

## Components

### `supabase/functions/transcribe/index.ts` (new)

- Accepts `POST` `multipart/form-data` with one field, `audio` (a file). Handles `OPTIONS` for CORS like `chat-meal`.
- Rejects a missing file or one over 2 MB with `400 { error }`.
- Forwards to `POST https://api.openai.com/v1/audio/transcriptions` as multipart with:
  - `file`: the uploaded blob, keeping its filename
  - `model`: `TRANSCRIBE_MODEL`, a constant at the top of the file, set to `'gpt-4o-transcribe'`
  - `language`: `'en'`
  - `prompt`: `'Meal description. Indian foods like idli, dosa, paneer, roti, chapati, dal, sambar, biryani, katori; quantities in grams.'`
- On OpenAI success returns `200 { text }` (trimmed). On OpenAI failure returns `502 { error }` and logs the OpenAI status/body with `console.error`.
- JWT verification stays on (no `config.toml` entry).

### `src/hooks/useVoiceRecorder.ts` (new)

```ts
type VoiceState = 'idle' | 'recording' | 'transcribing';
function useVoiceRecorder(onTranscript: (text: string) => void): {
  state: VoiceState;
  seconds: number; // elapsed while recording, 0 otherwise
  toggle: () => void;
};
```

- `toggle()` from `idle`: `navigator.mediaDevices.getUserMedia({ audio: true })`, `new MediaRecorder(stream)`, collect `dataavailable` chunks, start a 1s ticker for `seconds`, state → `recording`.
- `toggle()` from `recording`, or `seconds` reaching `MAX_SECONDS = 120`: stop the recorder, stop all stream tracks (releases the mic), build a `Blob` from the chunks with `recorder.mimeType`.
  - If the recording lasted under 0.5s: discard, state → `idle`.
  - Else state → `transcribing`, build `FormData` with `audio` = the blob, filename `voice.<ext>` where `<ext>` is derived from the mime type (`webm`, `ogg`, `mp4`→`m4a`, fallback `webm`), call `supabase.functions.invoke('transcribe', { body: formData })`, then state → `idle`.
  - Non-empty `text` → `onTranscript(text)`. Empty text → toast "Didn't catch anything". Error → destructive toast "Couldn't transcribe — try again or type it".
- `toggle()` while `transcribing` is a no-op (the button is disabled too).
- Unmount while recording: stop the recorder and tracks, discard the chunks, no request.
- `getUserMedia` rejecting (permission denied or unavailable) → destructive toast "Microphone permission needed", state stays `idle`.

### `src/components/ChatMealLog.tsx` (modified)

- Remove all speech-recognition code listed under Context, and the `MAX_FAILED_RESTARTS` constant.
- Add `const voice = useVoiceRecorder((text) => setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text)));`
- The mic button calls `voice.toggle`, is disabled while `voice.state === 'transcribing'`, and shows the stop/active styling while `recording`. The existing "Listening…" line becomes `Recording 0:07` (formatted `m:ss` from `voice.seconds`) while recording, and `Transcribing…` while transcribing.

### Removals

- `npm uninstall @capacitor-community/speech-recognition patch-package`
- Delete `patches/` and the `postinstall` script from `package.json`.
- `npx cap sync android` so the plugin leaves `android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle`.

## Error handling summary

| Case | Behavior |
|---|---|
| Mic permission denied / `getUserMedia` unavailable | Toast "Microphone permission needed", stay idle |
| Recording < 0.5s | Discard silently |
| Network / edge function / OpenAI failure | Destructive toast, clip discarded, box untouched |
| Empty transcript | Toast "Didn't catch anything", box untouched |
| 120s reached | Auto-stop and transcribe |
| Leave Chat while recording | Recorder and mic released, nothing sent |
| Tap while transcribing | Button disabled, no-op |
| App backgrounded mid-recording | No special handling; whatever was captured is transcribed on stop |

## Data model / backend

No migrations, no table changes, so `src/integrations/supabase/types.ts` does not need regenerating. One new edge function, `transcribe`, deployed to project `ppbckzgqevfpkhymwuxs`. It reuses the existing `OPENAI_API_KEY` secret.

## Implementation order

1. **Spike (throwaway):** temporary debug button that records 3s with `MediaRecorder` and logs blob size + `mimeType`; run on the phone and read logcat. Works → delete it, continue. Fails → stop and revisit approach B with the user.
2. Write and deploy `transcribe`; verify with `curl` and a short recorded clip plus a user session token.
3. Add `useVoiceRecorder`, rewire `ChatMealLog`.
4. Removals above.

## Testing / verification

1. `npm run typecheck` and `npm run lint`: 0 errors.
2. On the adb-connected phone:
   - Dictate "two eggs and toast", pause 3s+, "with butter and a banana", tap stop → full sentence in the box.
   - Dictate twice in a row → second transcript appended after the first with a space.
   - Deny mic permission once → permission toast.
   - Airplane mode → failure toast, box untouched.
   - Leave Chat mid-recording → mic indicator in the status bar goes away.
3. Delete any `chat_messages` rows created during testing.

## Out of scope

- Live/partial transcription while speaking.
- Voice input anywhere other than Chat.
- Offline voice input.
