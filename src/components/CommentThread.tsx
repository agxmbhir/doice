import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MessageCircle, X, Smile } from 'lucide-react';

export type CommentItem = {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: number;
  t?: number;
  start?: number;
  end?: number;
  quoteText?: string;
  reactions?: Record<string, string[]>; // emoji -> array of clientIds
};

type ThreadProps = {
  items: CommentItem[];
  byParent: Map<string | null, CommentItem[]>;
  rootId?: string | null;
  onSeek: (t: number) => void;
  onReply: (parentId: string, text: string, t?: number) => Promise<void> | void;
  depth?: number;
  onReact?: (commentId: string, emoji: string, nextOn: boolean) => void | Promise<void>;
  clientId?: string;
};

export function CommentThread({ items, byParent, rootId = null, onSeek, onReply, depth = 0, onReact, clientId }: ThreadProps): JSX.Element {
  const children = byParent.get(rootId) || [];
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [reactOpen, setReactOpen] = React.useState<Record<string, boolean>>({});
  const triggerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const dismissTimersRef = React.useRef<Record<string, number>>({});
  const openId = React.useMemo(() => Object.entries(reactOpen).find(([_, v]) => v)?.[0] || null, [reactOpen]);

  function clearTimer(id?: string) {
    const key = id || (openId || '');
    if (!key) return;
    const t = dismissTimersRef.current[key];
    if (t) {
      clearTimeout(t);
      delete dismissTimersRef.current[key];
    }
  }

  function startTimer(id: string) {
    clearTimer(id);
    dismissTimersRef.current[id] = window.setTimeout(() => {
      setReactOpen((o) => ({ ...o, [id]: false }));
    }, 2500);
  }

  React.useEffect(() => {
    const onExternalOpen = (e: any) => {
      const otherId = e?.detail as string | null;
      if (!otherId) return;
      // Close this component's open palette if it's not the one that was just opened elsewhere
      if (openId && openId !== otherId) {
        setReactOpen({});
        clearTimer(openId);
      }
    };
    window.addEventListener('doice-reaction-open', onExternalOpen as any);
    return () => window.removeEventListener('doice-reaction-open', onExternalOpen as any);
  }, [openId]);
  const quickEmojis = ['👍', '❤️', '😂', '😮', '👏'];
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
                      {formatTime(Math.floor(c.start!))}–{formatTime(Math.floor(c.end!))}
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
              {/* Quoted transcript preview (reply-style, clean and readable) */}
              {(c.quoteText || (typeof c.start === 'number' && typeof c.end === 'number')) ? (
                <div className="mb-2 overflow-hidden rounded-md border bg-muted/20">
                  <div className="flex items-start">
                    <div className="h-full w-1 bg-primary/80" />
                    <div className="flex-1 p-2">
                      {null}
                      {c.quoteText ? (
                        <div className="line-clamp-3 text-sm leading-5 text-muted-foreground">{c.quoteText}</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="whitespace-pre-wrap text-sm text-foreground">{c.text}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {drafts[c.id] === undefined ? (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => setDrafts((d) => ({ ...d, [c.id]: '' }))}>
                    <MessageCircle className="mr-1 h-4 w-4" /> Reply
                  </Button>
                ) : null}
                {/* React palette toggle */}
                {onReact ? (
                  <div className="relative">
                    <Button
                      ref={(el) => { triggerRefs.current[c.id] = el; }}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const next = !reactOpen[c.id];
                        if (next) {
                          // Only one open globally
                          setReactOpen({ [c.id]: true });
                          window.dispatchEvent(new CustomEvent('doice-reaction-open', { detail: c.id }));
                          startTimer(c.id);
                        } else {
                          setReactOpen((o) => ({ ...o, [c.id]: false }));
                          clearTimer(c.id);
                        }
                      }}
                      aria-expanded={!!reactOpen[c.id]}
                      aria-label="React"
                    >
                      <Smile className="mr-1 h-4 w-4" />
                    </Button>
                    <AnimatePresence>
                      {reactOpen[c.id] ? (
                        <PalettePortal anchorEl={triggerRefs.current[c.id]} onMouseEnter={() => clearTimer(c.id)} onMouseLeave={() => startTimer(c.id)}>
                          <div className="flex items-center gap-1">
                            {quickEmojis.map((e) => (
                              <button
                                key={e}
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-accent"
                                onClick={async () => {
                                  if (onReact) await onReact(c.id, e, true);
                                  setReactOpen((o) => ({ ...o, [c.id]: false }));
                                  clearTimer(c.id);
                                }}
                                aria-label={`React ${e}`}
                              >
                                <span className="text-base">{e}</span>
                              </button>
                            ))}
                          </div>
                        </PalettePortal>
                      ) : null}
                    </AnimatePresence>
                  </div>
                ) : null}
                {/* Reaction chips (now appear after Reply and React) */}
                {c.reactions ? (
                  Object.entries(c.reactions)
                    .filter(([, arr]) => Array.isArray(arr) && arr.length > 0)
                    .sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0))
                    .map(([emoji, arr]) => {
                      const reacted = !!clientId && Array.isArray(arr) && arr.includes(clientId);
                      const count = Array.isArray(arr) ? arr.length : 0;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          className={(reacted ? 'border-primary bg-primary/10 ' : 'border-transparent bg-muted ') + 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted/70'}
                          onClick={() => onReact && onReact(c.id, emoji, !reacted)}
                          aria-pressed={reacted}
                        >
                          <span>{emoji}</span>
                          <span className="tabular-nums">{count}</span>
                        </button>
                      );
                    })
                ) : null}
              </div>
              {null}
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
                <CommentThread items={items} byParent={byParent} rootId={c.id} onSeek={onSeek} onReply={onReply} depth={depth + 1} onReact={onReact} clientId={clientId} />
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

function PalettePortal({ anchorEl, children, onMouseEnter, onMouseLeave }: { anchorEl: HTMLElement | null | undefined; children: React.ReactNode; onMouseEnter?: () => void; onMouseLeave?: () => void }) {
  const [style, setStyle] = React.useState<React.CSSProperties>({});
  const [mounted, setMounted] = React.useState(false);
  React.useLayoutEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const top = rect.bottom + 8; // below the icon
    const left = rect.left + rect.width / 2; // center aligned with icon
    setStyle({ position: 'fixed', top, left, transform: 'translateX(-50%) translateY(6px)', zIndex: 1000, opacity: 0, pointerEvents: 'auto' });
    setMounted(true);
  }, [anchorEl]);
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null as any;
  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      className="rounded-md border bg-background p-1 shadow-md"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      {mounted ? children : null}
    </motion.div>,
    root
  );
}