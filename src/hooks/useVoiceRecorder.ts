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
