import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type VoiceState = 'idle' | 'recording' | 'transcribing';

const MAX_SECONDS = 120;
const MIN_MS = 500;
// Peak RMS (0..1) a clip must reach to count as speech. Room noise on the
// test phone (SM-E066B) sits well below this; normal speech well above.
// ponytail: one fixed threshold; calibrate per device if quiet speakers get dropped.
const SILENCE_RMS = 0.02;

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
  const startingRef = useRef(false);
  const cancelStartRef = useRef(false);
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
      cancelStartRef.current = true;
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
    if (startingRef.current) {
      cancelStartRef.current = true;
      return;
    }
    if (state === 'recording') {
      stop();
      return;
    }
    if (state !== 'idle') return;

    startingRef.current = true;
    cancelStartRef.current = false;
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
    } finally {
      startingRef.current = false;
    }

    // Mic level meter for the silence gate. If it can't be set up, skip the gate.
    let peak = Infinity;
    let meter: ReturnType<typeof setInterval> | undefined;
    let audioCtx: AudioContext | undefined;
    try {
      audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      peak = 0;
      meter = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        peak = Math.max(peak, Math.sqrt(sum / samples.length));
      }, 100);
    } catch (err) {
      console.warn('Silence gate unavailable:', err);
      void audioCtx?.close();
      audioCtx = undefined;
      peak = Infinity;
    }
    const release = () => {
      clearInterval(meter);
      meter = undefined;
      if (audioCtx) void audioCtx.close();
      audioCtx = undefined;
      stream.getTracks().forEach((t) => t.stop());
    };
    if (cancelStartRef.current) {
      release();
      return;
    }
    const failStart = (err: unknown) => {
      release();
      recorderRef.current = null;
      console.error('Recorder start error:', err);
      toast({ title: "Couldn't start recording", variant: 'destructive' });
    };

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream);
    } catch (err) {
      failStart(err);
      return;
    }
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    discardRef.current = false;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => {
      if (recorder.state !== 'inactive') recorder.stop();
      else {
        release();
        recorderRef.current = null;
        setState('idle');
      }
    };
    recorder.onstop = () => {
      release();
      recorderRef.current = null;
      setSeconds(0);
      if (discardRef.current || Date.now() - startedAt < MIN_MS) {
        setState('idle');
        return;
      }
      if (!chunks.length) {
        setState('idle');
        toast({ title: "Didn't catch anything" });
        return;
      }
      console.log(`voice: peak rms ${peak.toFixed(4)}`); // calibration aid; read via adb logcat
      if (peak < SILENCE_RMS) {
        setState('idle');
        toast({ title: "Didn't catch anything" });
        return;
      }
      void transcribe(new Blob(chunks, { type: recorder.mimeType }));
    };
    recorderRef.current = recorder;
    try {
      recorder.start();
    } catch (err) {
      failStart(err);
      return;
    }
    setSeconds(0);
    setState('recording');
  };

  return { state, seconds, toggle };
}
