import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Mic, StopCircle, Link as LinkIcon, Timer, ShieldAlert, Check, RotateCcw } from 'lucide-react';
import { AudioBox } from '../components/AudioBox';
import { LiveWaveform } from '../components/LiveWaveform';

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

export const RecordPage: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [timerMs, setTimerMs] = useState(0);
  const [status, setStatus] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sessionIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
        audioCtxRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Reset copy label whenever a new URL arrives
    setCopied(false);
  }, [shareUrl]);

  async function startRecording() {
    try {
      setStatus('Recording…');
      chunksRef.current = [];
      const sessionId = ++sessionIdRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeTypeOptions = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
      const mimeType = mimeTypeOptions.find((type) => MediaRecorder.isTypeSupported(type)) || '';
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 512;
      source.connect(analyserNode);
      analyserRef.current = analyserNode;
      audioCtxRef.current = ctx;
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const isStale = sessionId !== sessionIdRef.current;
        if (timerRef.current) window.clearInterval(timerRef.current);
        analyserRef.current = null;
        if (audioCtxRef.current) {
          try { await audioCtxRef.current.close(); } catch {}
          audioCtxRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        const localUrl = URL.createObjectURL(blob);
        if (!isStale) setAudioUrl(localUrl);
        if (!isStale) setStatus('Uploading…');
        try {
          const form = new FormData();
          form.append('file', blob, `memo-${Date.now()}.webm`);
          const res = await fetch('/api/upload', { method: 'POST', body: form });
          if (!res.ok) throw new Error('Upload failed');
          const { shareUrl: url } = await res.json();
          if (!isStale) setShareUrl(url);
          if (!isStale) setStatus('Ready to share!');
          if ('clipboard' in navigator) {
            try {
              await navigator.clipboard.writeText(url);
              if (!isStale) {
                setCopied(true);
                if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
                copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
              }
            } catch {}
          }
        } catch (err) {
          console.error(err);
          if (!isStale) setStatus('Upload error');
        }
      };
      mr.start(100);
      setIsRecording(true);
      const startedAt = Date.now();
      setTimerMs(0);
      timerRef.current = window.setInterval(() => setTimerMs(Date.now() - startedAt), 250);
    } catch (err) {
      console.error(err);
      setStatus('Mic permission denied or unsupported.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setStatus('Processing…');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
  }

  function discardAndRestart() {
    sessionIdRef.current++;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch {}
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch {}
      audioCtxRef.current = null;
    }
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    if (audioUrl) {
      try { URL.revokeObjectURL(audioUrl); } catch {}
    }
    setAudioUrl('');
    setShareUrl('');
    setCopied(false);
    setTimerMs(0);
    setIsRecording(false);
    setStatus('');
    void startRecording();
  }

  async function copyShare() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const sel = document.createElement('input');
        sel.value = shareUrl;
        document.body.appendChild(sel);
        sel.select();
        document.execCommand('copy');
        document.body.removeChild(sel);
        setCopied(true);
        if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }

  return (
    <Card>
      {/* Major layout improvement: bring a clean card shell with clearer hierarchy */}
      <CardHeader>
        <CardTitle>Record a voice memo</CardTitle>
        <CardDescription>Capture audio and share instantly with a link.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Button
            variant={isRecording ? 'destructive' : 'default'}
            onClick={isRecording ? stopRecording : startRecording}
            className="transition-transform duration-150 hover:scale-[1.02] active:scale-95"
          >
            {isRecording ? (
              <>
                <StopCircle className="mr-2 h-4 w-4" /> Stop
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" /> Start
              </>
            )}
          </Button>
          {audioUrl && !isRecording ? (
            <Button
              type="button"
              variant="ghost"
              onClick={discardAndRestart}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-transform hover:scale-[1.02] active:scale-95"
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Discard & Record Again
            </Button>
          ) : null}
          <div className="ml-auto inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Timer className="h-4 w-4" />
            <span aria-live="polite">{formatTime(timerMs)}</span>
          </div>
        </div>
        {/* Live microphone waveform */}
        {isRecording ? (
          <LiveWaveform analyser={analyserRef.current} className="mt-3 reveal-in" />
        ) : null}
        {audioUrl ? (
          <AudioBox
            ref={audioRef}
            controls
            src={audioUrl}
            className="mt-4 reveal-in"
            right={<span className="text-xs text-gray-500 dark:text-gray-400">Local preview</span>}
          />
        ) : null}
        {audioUrl && !isRecording ? null : null}
        {shareUrl ? (
          <div className="mt-4 flex items-center gap-2">
            <Input readOnly value={shareUrl} aria-label="Share URL" />
            <Button onClick={copyShare} variant="secondary">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <LinkIcon className="mr-2 h-4 w-4" /> Copy
                </>
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};


