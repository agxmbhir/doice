import * as React from 'react';
import { cn } from '../lib/utils';
import { AudioLines, Pause, Play } from 'lucide-react';
import WavesurferPlayer from '@wavesurfer/react';

export type AudioBoxProps = React.AudioHTMLAttributes<HTMLAudioElement> & {
  right?: React.ReactNode;
  className?: string;
  onTimeUpdate?: (t: number) => void;
};

// Polished audio container for a modern look, keeps native controls for reliability
export const AudioBox = React.forwardRef<any, AudioBoxProps>(
  ({ className, right, src, controls, onTimeUpdate, ...props }, ref) => {
    const [useWaveform, setUseWaveform] = React.useState(true);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const wavesurferRef = React.useRef<any>(null);
    const nativeAudioRef = React.useRef<HTMLAudioElement | null>(null);

    React.useEffect(() => {
      // Whenever the source changes, try the waveform again.
      setUseWaveform(true);
      wavesurferRef.current = null;
    // Do not auto-fallback based on time; long files can take time to decode.
    // We'll only fallback on explicit onError from Wavesurfer.
    return () => {};
    }, [src]);

    // Hook up time update events for waveform player
    React.useEffect(() => {
      const ws = wavesurferRef.current;
      if (!useWaveform || !ws) return;
      const handleProcess = (t: number) => {
        if (typeof onTimeUpdate === 'function') onTimeUpdate(t);
      };
      const handleSeek = (progress: number) => {
        const duration = typeof ws.getDuration === 'function' ? ws.getDuration() : 0;
        if (typeof onTimeUpdate === 'function') onTimeUpdate(progress * duration);
      };
      ws.on('audioprocess', handleProcess);
      ws.on('seek', handleSeek);
      return () => {
        ws.un('audioprocess', handleProcess);
        ws.un('seek', handleSeek);
      };
    }, [useWaveform, onTimeUpdate]);

    // Expose a small control API through the ref for both modes (always use latest refs)
    React.useImperativeHandle(ref, () => ({
      seekTo: (t: number) => {
        const ws = wavesurferRef.current;
        if (useWaveform && ws) {
          if (typeof ws.setTime === 'function') {
            ws.setTime(t);
          } else if (typeof ws.seekTo === 'function' && typeof ws.getDuration === 'function') {
            const dur = ws.getDuration() || 1;
            ws.seekTo(Math.max(0, Math.min(1, t / dur)));
          }
          if (typeof ws.play === 'function') ws.play();
          return;
        }
        const el = nativeAudioRef.current;
        if (!el) return;
        el.currentTime = t;
        void el.play();
      },
      play: () => {
        const ws = wavesurferRef.current;
        if (useWaveform && ws && typeof ws.play === 'function') {
          ws.play();
          return;
        }
        const el = nativeAudioRef.current;
        if (el) void el.play();
      },
      getCurrentTime: () => {
        const ws = wavesurferRef.current;
        if (useWaveform && ws && typeof ws.getCurrentTime === 'function') {
          return ws.getCurrentTime();
        }
        const el = nativeAudioRef.current;
        return el ? el.currentTime : 0;
      },
      // Also expose the raw element for compatibility
      get element() {
        return nativeAudioRef.current;
      },
    }), [useWaveform]);

    return (
      <div
        className={cn(
          'rounded-3xl border border-border bg-card p-3 shadow-sm',
          className
        )}
      >
        <div className="mb-2 flex items-center justify-between px-1 text-sm text-gray-600 dark:text-gray-300">
          <div className="inline-flex items-center gap-2">
            <AudioLines className="h-4 w-4" />
            <span>Audio</span>
          </div>
          {right}
        </div>
        {useWaveform && src ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
              onClick={() => {
                const ws = wavesurferRef.current;
                if (!ws) return;
                ws.isPlaying() ? ws.pause() : ws.play();
              }}
              className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow hover:opacity-90', !wavesurferRef.current && 'opacity-50 pointer-events-none')}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <div className="flex-1">
              <WavesurferPlayer
                height={48}
                url={src}
                waveColor={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#444' : '#CBD5E1'}
                progressColor={typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? '#60A5FA' : '#3B82F6'}
                cursorColor={'transparent'}
                barHeight={1}
                barWidth={2}
                barGap={1}
                cursorWidth={0}
                dragToSeek={true}
                normalize={true}
                onReady={(ws) => {
                  wavesurferRef.current = ws;
                }}
                onError={() => {
                  // If Wavesurfer reports an error, gracefully degrade
                  setUseWaveform(false);
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onFinish={() => setIsPlaying(false)}
              />
            </div>
          </div>
        ) : (
          <audio
            ref={(node) => {
              nativeAudioRef.current = node;
            }}
            src={src}
            controls={controls}
            onTimeUpdate={(e) => {
              if (typeof onTimeUpdate === 'function') onTimeUpdate((e.target as HTMLAudioElement).currentTime);
            }}
            {...props}
            className={cn('w-full overflow-hidden rounded-2xl')}
          />
        )}
      </div>
    );
  }
);
AudioBox.displayName = 'AudioBox';


