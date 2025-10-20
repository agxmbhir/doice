import * as React from 'react';
import { cn } from '../lib/utils';

type LiveWaveformProps = {
  analyser: AnalyserNode | null;
  className?: string;
  lineWidth?: number;
  color?: string; // stroke color
  backgroundColor?: string; // optional background fill
  mode?: 'bars' | 'line';
  barWidth?: number;
  barGap?: number;
};

// Lightweight canvas waveform that renders the current time-domain signal from an AnalyserNode
export function LiveWaveform({ analyser, className, lineWidth = 2, color = '#3B82F6', backgroundColor, mode = 'bars', barWidth = 2, barGap = 1 }: LiveWaveformProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const dataRef = React.useRef<Uint8Array | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    cancel();
    if (!analyser) return;
    // Prepare a stable buffer sized to the current analyser fft
    dataRef.current = new Uint8Array(analyser.fftSize);

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const buffer = dataRef.current;
      if (!buffer) return;
      analyser.getByteTimeDomainData(buffer);

      const { width, height } = canvas;
      // Clear background
      if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height);
      }

      // Draw center line subtle background for context
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (mode === 'bars') {
        // Bar waveform (vertical rounded lines)
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        const dpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
        const barW = Math.max(1, Math.floor(barWidth * dpr));
        const gap = Math.max(0, Math.floor(barGap * dpr));
        const step = barW + gap;
        const numBars = Math.max(1, Math.floor(width / step));
        const slice = Math.floor(buffer.length / numBars) || 1;
        for (let i = 0; i < numBars; i++) {
          // Compute peak in the slice for a crisp look
          let peak = 0;
          const start = i * slice;
          const end = Math.min(buffer.length, start + slice);
          for (let j = start; j < end; j++) {
            const v = Math.abs(buffer[j] / 128.0 - 1.0);
            if (v > peak) peak = v;
          }
          const h = Math.max(2, Math.min(height * 0.9, peak * height));
          const x = i * step + barW / 2;
          const y1 = (height - h) / 2;
          const y2 = y1 + h;
          ctx.lineWidth = barW;
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
        }
      } else {
        // Smooth line waveform
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        const sliceWidth = width / buffer.length;
        let x = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = buffer[i] / 128.0 - 1.0; // [-1, 1]
          const y = height / 2 + v * (height * 0.45);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return cancel;
  }, [analyser, color, lineWidth, backgroundColor, mode, barWidth, barGap]);

  function cancel() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  return (
    <div className={cn('w-full overflow-hidden rounded-2xl border border-border bg-card', className)}>
      <canvas ref={canvasRef} className="block h-24 w-full" />
    </div>
  );
}

export default LiveWaveform;


