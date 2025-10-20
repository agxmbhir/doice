import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export type TranscriptWord = { text: string; start: number; end: number };

export interface TranscriptLineProps {
  lineIndex: number;
  start: number;
  end: number;
  words: TranscriptWord[];
  baseWordIndex: number;
  active: boolean;
  onSeek: (t: number) => void;
  className?: string;
  currentTime?: number;
}

function toBlurb(words: TranscriptWord[], maxWords: number): { words: TranscriptWord[]; truncated: boolean } {
  if (words.length <= maxWords) return { words, truncated: false };
  return { words: words.slice(0, maxWords), truncated: true };
}

function formatTime(sec: number): string {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

export const LINE_HEIGHT_PX = 56; // h-14

export const TranscriptLine: React.FC<TranscriptLineProps> = ({
  lineIndex,
  start,
  end,
  words,
  baseWordIndex,
  active,
  onSeek,
  className,
  currentTime,
}) => {
  const { words: blurbWords, truncated } = toBlurb(words, 22);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0.6, scale: 0.98 }}
      animate={{ opacity: active ? 1 : 0.85, scale: active ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, mass: 0.6 }}
      onClick={() => onSeek(start)}
      className={cn(
        'h-14 w-full cursor-pointer select-text rounded-md px-3 text-left',
        'flex items-center gap-3 border',
        active
          ? 'bg-primary/10 border-primary/20 shadow-sm ring-1 ring-primary/30'
          : 'hover:bg-muted/50 border-transparent',
        className,
      )}
      aria-current={active ? 'true' : undefined}
      data-line-idx={lineIndex}
    >
      <span className={cn('shrink-0 rounded-md px-2 py-1 text-[11px] font-medium', active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}
        onClick={(e) => { e.stopPropagation(); onSeek(start); }}
      >
        {formatTime(start)}
      </span>
      <div className="min-w-0 flex-1 text-sm leading-snug text-foreground/90">
        {blurbWords.map((w, i) => {
          const isCurrent = active && typeof currentTime === 'number' && currentTime >= w.start && currentTime <= w.end;
          const isPlayed = active && typeof currentTime === 'number' && currentTime > w.end;
          return (
            <span
              key={i}
              data-word-idx={baseWordIndex + i}
              className={cn(
                'word inline rounded-sm',
                isCurrent ? 'bg-primary/15 text-primary px-0.5' : '',
                isPlayed ? '' : (active ? 'opacity-90' : 'opacity-100')
              )}
              onClick={(e) => { e.stopPropagation(); onSeek(w.start); }}
            >
              {w.text}
              {i < blurbWords.length - 1 ? ' ' : ''}
            </span>
          );
        })}
        {truncated ? '…' : ''}
      </div>
    </motion.button>
  );
};


