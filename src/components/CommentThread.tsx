import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MessageCircle, X } from 'lucide-react';

export type CommentItem = {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: number;
  t?: number;
  start?: number;
  end?: number;
};

type ThreadProps = {
  items: CommentItem[];
  byParent: Map<string | null, CommentItem[]>;
  rootId?: string | null;
  onSeek: (t: number) => void;
  onReply: (parentId: string, text: string, t?: number) => Promise<void> | void;
  depth?: number;
};

export function CommentThread({ items, byParent, rootId = null, onSeek, onReply, depth = 0 }: ThreadProps): JSX.Element {
  const children = byParent.get(rootId) || [];
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {children.map((c) => (
          <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="">
            <div className="rounded-lg bg-muted/30 p-3">
              {depth === 0 ? (
                <div className="mb-1">
                  {typeof c.start === 'number' && typeof c.end === 'number' ? (
                    <button
                      className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300"
                      onClick={() => onSeek(c.start!)}
                    >
                      {formatTime(Math.floor(c.start!))}
                    </button>
                  ) : (
                    <button
                      className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300"
                      onClick={() => onSeek(Math.floor(c.t || 0))}
                    >
                      {formatTime(Math.floor(c.t || 0))}
                    </button>
                  )}
                </div>
              ) : null}
              <div className="whitespace-pre-wrap text-sm text-foreground">{c.text}</div>
              <div className="mt-2 flex items-center gap-3">
                {drafts[c.id] === undefined ? (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => setDrafts((d) => ({ ...d, [c.id]: '' }))}>
                    <MessageCircle className="mr-1 h-4 w-4" /> Reply
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-2">
              {drafts[c.id] === undefined ? (
                null
              ) : (
                <div className="relative rounded-lg border border-dashed bg-background p-2">
                  <button
                    type="button"
                    aria-label="Dismiss reply"
                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent"
                    onClick={() => setDrafts((d) => { const nd = { ...d }; delete nd[c.id]; return nd; })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex gap-2 pr-8">
                    <Input value={drafts[c.id] || ''} onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))} placeholder="Write a reply…" />
                    <Button size="sm"
                      onClick={async () => {
                        const text = (drafts[c.id] || '').trim();
                        if (!text) return;
                        await onReply(c.id, text, c.t);
                        setDrafts((d) => { const nd = { ...d }; delete nd[c.id]; return nd; });
                      }}
                      disabled={!(drafts[c.id] || '').trim()}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" /> Post
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {byParent.get(c.id)?.length ? (
              <div className="mt-3 border-l pl-3">
                <CommentThread items={items} byParent={byParent} rootId={c.id} onSeek={onSeek} onReply={onReply} depth={depth + 1} />
              </div>
            ) : null}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function formatTime(msOrSec: number): string {
  const s = Math.floor(msOrSec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}



