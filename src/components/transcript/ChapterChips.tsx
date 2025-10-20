import React, { useEffect, useMemo, useRef } from 'react';
import { Badge } from '../ui/badge';
import { Tooltip } from '../ui/tooltip';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export interface ChapterItem { title: string; start: number; end: number }

function shortTitle(title: string): string {
  // Show full title without truncation for horizontal scroll strip
  return String(title || '').trim();
}

function formatTime(s: number): string {
  const sec = Math.floor(s);
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

export const ChapterChips: React.FC<{ items: ChapterItem[]; currentTime: number; onSeek: (t: number) => void }>
  = ({ items, currentTime, onSeek }) => {
    const activeIdx = useMemo(() => items.findIndex(c => currentTime >= c.start && currentTime <= c.end), [items, currentTime]);
    const railRef = useRef<HTMLDivElement | null>(null);

    // Auto-scroll the horizontal rail to keep the active pill in view
    useEffect(() => {
      const el = railRef.current;
      if (!el) return;
      const active = el.querySelector('[data-active="true"]') as HTMLElement | null;
      if (!active) return;
      const left = active.offsetLeft - 12;
      const right = left + active.offsetWidth + 24;
      if (left < el.scrollLeft) el.scrollTo({ left: Math.max(0, left - 16), behavior: 'smooth' });
      else if (right > el.scrollLeft + el.clientWidth) el.scrollTo({ left: right - el.clientWidth, behavior: 'smooth' });
    }, [activeIdx]);

    return (
      <div className="relative">
        <div ref={railRef} className="nice-scroll w-full max-w-full overflow-x-auto overflow-y-hidden">
          <div className="flex w-max flex-nowrap items-stretch gap-2 py-1 px-2">
            {items.map((c, i) => {
              const active = i === activeIdx;
              return (
                <Tooltip key={i} content={`${formatTime(c.start)} · ${c.title}`}>
                  <motion.button
                    type="button"
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSeek(c.start)}
                    data-active={active ? 'true' : undefined}
                    className={cn(
                      'relative inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap',
                      'bg-card/60 backdrop-blur transition-colors',
                      active
                        ? 'border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/30'
                        : 'hover:bg-muted/60'
                    )}
                  >
                    <Badge variant="outline" className={cn('h-5 rounded-full px-1.5 text-[10px] font-semibold', active ? 'border-primary/50 text-primary' : '')}>
                      {formatTime(c.start)}
                    </Badge>
                    <span className={cn('inline-block', active ? 'font-semibold' : 'font-medium')}>{shortTitle(c.title)}</span>
                  </motion.button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    );
  };



