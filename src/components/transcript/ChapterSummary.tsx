import React from 'react';
import { cn } from '../../lib/utils';

export interface ChapterItem {
  title: string;
  start: number;
  end: number;
}

function summarize(title: string): string {
  const words = String(title || '').trim().split(/\s+/).filter(Boolean);
  const short = words.slice(0, 3).join(' ');
  return short || 'Chapter';
}

function formatTime(s: number): string {
  const sec = Math.floor(s);
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

export const ChapterSummary: React.FC<{ items: ChapterItem[]; currentTime: number; onSeek: (t: number) => void; className?: string }>
  = ({ items, currentTime, onSeek, className }) => {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {items.map((c, i) => {
          const active = currentTime >= c.start && currentTime <= c.end;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSeek(c.start)}
              className={cn('rounded-md border px-2 py-1 text-sm transition', active ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}
            >
              <span className="opacity-80 mr-1">{formatTime(c.start)}</span>
              {summarize(c.title || 'Chapter')}
            </button>
          );
        })}
      </div>
    );
  };


