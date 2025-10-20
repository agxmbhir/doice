import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { TranscriptLine, TranscriptWord, LINE_HEIGHT_PX } from './TranscriptLine';
import { cn } from '../../lib/utils';

export interface TranscriptLineData {
  text: string;
  start: number;
  end: number;
  from: number; // word index inclusive
  to: number;   // word index inclusive
}

export interface TranscriptScrollerProps {
  lines: TranscriptLineData[];
  words: TranscriptWord[];
  currentTime: number;
  onSeek: (t: number) => void;
  className?: string;
  chapters?: { title: string; start: number; end: number }[];
}

export const TranscriptScroller: React.FC<TranscriptScrollerProps> = ({ lines, words, currentTime, onSeek, className, chapters }) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const activeIndex = useMemo(() => {
    const idx = lines.findIndex((l) => currentTime >= l.start && currentTime <= l.end);
    return idx === -1 ? 0 : idx;
  }, [lines, currentTime]);

  const chapterByLine = useMemo(() => {
    const map = new Map<number, string>();
    if (!chapters || chapters.length === 0) return map;
    for (const ch of chapters) {
      const lineIdx = lines.findIndex((l) => l.start >= ch.start);
      if (lineIdx >= 0 && !map.has(lineIdx)) map.set(lineIdx, ch.title);
    }
    return map;
  }, [chapters, lines]);

  // Keep the active line centered smoothly
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const targetTop = activeIndex * LINE_HEIGHT_PX + LINE_HEIGHT_PX / 2;
    const nextScrollTop = Math.max(0, targetTop - vp.clientHeight / 2);
    vp.scrollTo({ top: nextScrollTop, behavior: 'smooth' });
  }, [activeIndex]);

  return (
    <ScrollArea className={cn('h-[640px] rounded-lg bg-card/30 overflow-hidden', className)} viewportRef={viewportRef}>
      <div className="divide-y">
        {lines.map((l, i) => (
          <React.Fragment key={i}>
            {chapterByLine.has(i) ? (
              <div className="sticky top-0 z-10 -mt-px bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
                <div className="flex items-center gap-2 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  {chapterByLine.get(i)}
                </div>
              </div>
            ) : null}
            <div style={{ height: LINE_HEIGHT_PX }} className="px-2">
              <TranscriptLine
                lineIndex={i}
                start={l.start}
                end={l.end}
                words={words.slice(l.from, l.to + 1)}
                baseWordIndex={l.from}
                active={i === activeIndex}
                onSeek={onSeek}
                currentTime={currentTime}
              />
            </div>
          </React.Fragment>
        ))}
      </div>
    </ScrollArea>
  );
};


