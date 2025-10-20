import React, { useEffect, useMemo, useRef } from 'react';
import { Badge } from '../ui/badge';
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
    const [canLeft, setCanLeft] = React.useState(false);
    const [canRight, setCanRight] = React.useState(false);

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

    // Track edge affordance visibility based on scroll position/width
    useEffect(() => {
      const el = railRef.current;
      if (!el) return;
      const update = () => {
        // Accurately account for inner container horizontal padding so arrows only
        // show when there is meaningful overflow content to that side
        const inner = el.firstElementChild as HTMLElement | null;
        let padLeft = 0;
        let padRight = 0;
        if (inner) {
          const cs = getComputedStyle(inner);
          padLeft = parseFloat(cs.paddingLeft || '0') || 0;
          padRight = parseFloat(cs.paddingRight || '0') || 0;
        }
        const leftThreshold = Math.max(0, padLeft - 1);
        const rightThreshold = Math.max(0, padRight - 1);
        setCanLeft(el.scrollLeft > leftThreshold);
        setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - rightThreshold);
      };
      update();
      el.addEventListener('scroll', update, { passive: true });
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => {
        el.removeEventListener('scroll', update as any);
        ro.disconnect();
      };
    }, [items.length]);

    return (
      <div className="relative h-12 group">
        {/* Fading edges */}
        <div className={cn('pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity z-10', canLeft ? 'opacity-100' : 'opacity-0')} />
        <div className={cn('pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity z-10', canRight ? 'opacity-100' : 'opacity-0')} />
        {/* Scroll buttons */}
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => { const el = railRef.current; if (el) el.scrollBy({ left: -200, behavior: 'smooth' }); }}
          className={cn('absolute left-1 top-1/2 -translate-y-1/2 hidden h-7 w-7 items-center justify-center rounded-full bg-card shadow z-20', canLeft ? 'group-hover:flex' : 'hidden')}
        >
          <span className="sr-only">Left</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => { const el = railRef.current; if (el) el.scrollBy({ left: 200, behavior: 'smooth' }); }}
          className={cn('absolute right-1 top-1/2 -translate-y-1/2 hidden h-7 w-7 items-center justify-center rounded-full bg-card shadow z-20', canRight ? 'group-hover:flex' : 'hidden')}
        >
          <span className="sr-only">Right</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
        <div ref={railRef} className="nice-scroll h-full w-full max-w-full overflow-x-auto overflow-y-hidden relative z-0">
          <div className="flex h-full w-max flex-nowrap items-center gap-1 px-3">
            {items.map((c, i) => {
              const active = i === activeIdx;
              return (
                <motion.button
                  key={i}
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
              );
            })}
          </div>
        </div>
      </div>
    );
  };



