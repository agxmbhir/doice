import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { MessageCircle, SendHorizontal, X, MessageSquareText, Smile } from 'lucide-react';
import { AudioBox } from '../components/AudioBox';
import { TranscriptScroller } from '../components/transcript/TranscriptScroller';
import { ChapterSummary } from '../components/transcript/ChapterSummary';
import { ChapterChips } from '../components/transcript/ChapterChips';
import { ChatMessage, type ChatMsg } from '../components/ChatMessage';
import { CommentThread, type CommentItem } from '../components/CommentThread';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Request failed');
  return res.json();
}

type Chapter = { title: string; start: number; end: number };
type Word = { text: string; start: number; end: number };
type Line = { text: string; start: number; end: number; from: number; to: number };

function formatTime(msOrSec: number): string {
  const s = Math.floor(msOrSec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
}

function Chapters({ chapters, currentTime, onSeek }: { chapters: Chapter[]; currentTime: number; onSeek: (t: number) => void }) {
  return (
    <div className="space-y-2">
      <ChapterChips items={chapters} currentTime={currentTime} onSeek={onSeek} />
    </div>
  );
}

function Transcript({ lines, words, chapters, currentTime, onSeek, onMouseUp }: { lines: Line[]; words: Word[]; chapters: Chapter[]; currentTime: number; onSeek: (t: number) => void; onMouseUp?: () => void }) {
  return (
    <div id="transcript" onMouseUp={onMouseUp}>
      <TranscriptScroller lines={lines} words={words} currentTime={currentTime} onSeek={onSeek} chapters={chapters} />
    </div>
  );
}

export const SharePage: React.FC = () => {
  const { id } = useParams();
  const [meta, setMeta] = useState<any | null>(null);
  const [transcript, setTranscript] = useState<{ status: 'processing' | 'ready' | 'error'; words?: Word[]; lines?: Line[]; chapters?: Chapter[] }>({ status: 'processing' });
  const audioRef = useRef<any>(null);
  const [time, setTime] = useState(0);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; parentId: string | null; at?: number; lineIndex?: number; start?: number; end?: number; quoteText?: string; reactions?: Record<string, string[]>; text: string; createdAt: number }>>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<{ from: number; to: number; start: number; end: number; text: string } | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'ask' | 'comments'>('ask');
  const [askMessages, setAskMessages] = useState<ChatMsg[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const askScrollRef = useRef<HTMLDivElement | null>(null);
  const askScrollEndRef = useRef<HTMLDivElement | null>(null);
  const quickEmojis = ['👍', '❤️', '😂', '😮', '👏'];
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchJSON(`/api/memos/${id}`).then(setMeta).catch(() => setMeta({ error: true }));
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    (async () => {
      for (;;) {
        const res = await fetch(`/api/memos/${id}/transcript`);
        if (res.status === 202) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        if (!res.ok) {
          setTranscript({ status: 'error' });
          return;
        }
        const body = await res.json();
        if (body.status === 'ready') {
          if (!cancelled) setTranscript(body);
          return;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/memos/${id}/comments`);
        if (!res.ok) return;
        const body = await res.json();
        const list = Array.isArray(body.comments) ? body.comments : [];
        // Force createdAt ordering as requested (posted time)
        list.sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0));
        setComments(list);
      } catch {}
    })();
  }, [id]);

  // Time updates are handled by AudioBox via onTimeUpdate for both native and waveform modes

  function seek(t: number) {
    const el = audioRef.current as any;
    if (!el) return;
    if (typeof el.seekTo === 'function') {
      el.seekTo(t);
      return;
    }
    if ('currentTime' in el) {
      el.currentTime = t;
      if (typeof el.play === 'function') void el.play();
    }
  }

  function computeSelectedRange() {
    const root = document.getElementById('transcript');
    if (!root) return setSelection(null);
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setSelection(null); return; }
    const range = sel.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) { setSelection(null); return; }
    function findIdx(node: Node | null): number | null {
      let el: HTMLElement | null = node as HTMLElement;
      while (el && el !== root && !(el as HTMLElement).dataset?.wordIdx) {
        el = el.parentElement;
      }
      const idxStr = el?.dataset?.wordIdx;
      return typeof idxStr === 'string' ? parseInt(idxStr, 10) : null;
    }
    const a = findIdx(range.startContainer);
    const b = findIdx(range.endContainer);
    if (a == null || b == null) { setSelection(null); return; }
    const from = Math.min(a, b);
    const to = Math.max(a, b);
    const start = (transcript.words || [])[from]?.start ?? 0;
    const end = (transcript.words || [])[to]?.end ?? start;
    const text = (transcript.words || []).slice(from, to + 1).map(w => w.text).join(' ');
    setSelection({ from, to, start, end, text });
  }

  const commentsSorted = useMemo(() => {
    // Primary order by posted time; keep computed time for seek pills
    const withTime = comments.map((c: any) => ({ ...c, t: typeof c.start === 'number' ? c.start : (typeof c.at === 'number' ? c.at : (typeof c.lineIndex === 'number' ? (transcript.lines?.[c.lineIndex]?.start ?? 0) : 0)) }));
    withTime.sort((a, b) => (a?.createdAt || 0) - (b?.createdAt || 0));
    return withTime;
  }, [comments, transcript.lines]);

  const commentsByParent = useMemo(() => {
    const map = new Map<string | null, any[]>();
    for (const c of commentsSorted) {
      const key = (c.parentId as string | null) || null;
      const arr = map.get(key) || [];
      arr.push(c);
      map.set(key, arr);
    }
    return map;
  }, [commentsSorted]);

  useEffect(() => {
    // Auto-scroll Ask chat to bottom on new messages
    const el = askScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [askMessages]);

  async function postComment(partial: { text: string; parentId?: string | null; at?: number; lineIndex?: number; start?: number; end?: number; quoteText?: string }) {
    if (!id) return;
    const res = await fetch(`/api/memos/${id}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(partial),
    });
    if (!res.ok) throw new Error('Failed');
    const body = await res.json();
    setComments((prev) => [...prev, body.comment]);
  }

  // Generate a stable client id for reaction attribution (stored in localStorage)
  const clientId = React.useMemo(() => {
    try {
      const k = 'doice-client-id';
      const existing = localStorage.getItem(k);
      if (existing && existing.length > 0) return existing;
      const nid = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(k, nid);
      return nid;
    } catch {
      return 'anon';
    }
  }, []);

  async function toggleReaction(commentId: string, emoji: string, nextOn: boolean) {
    if (!id) return;
    // optimistic update
    setComments((prev) => prev.map((c) => {
      if (c.id !== commentId) return c;
      const next = { ...c, reactions: { ...(c.reactions || {}) } } as any;
      const arr = Array.isArray(next.reactions[emoji]) ? [...next.reactions[emoji]] : [];
      const has = arr.includes(clientId);
      if (nextOn && !has) arr.push(clientId);
      if (!nextOn && has) next.reactions[emoji] = arr.filter((x: string) => x !== clientId);
      else next.reactions[emoji] = arr;
      return next;
    }));
    try {
      await fetch(`/api/memos/${id}/comments/${commentId}/reactions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emoji, clientId, action: nextOn ? 'add' : 'remove' })
      });
    } catch {
      // revert on failure
      setComments((prev) => prev.map((c) => {
        if (c.id !== commentId) return c;
        const next = { ...c, reactions: { ...(c.reactions || {}) } } as any;
        const arr = Array.isArray(next.reactions[emoji]) ? [...next.reactions[emoji]] : [];
        const has = arr.includes(clientId);
        if (nextOn && has) next.reactions[emoji] = arr.filter((x: string) => x !== clientId);
        if (!nextOn && !has) next.reactions[emoji] = [...arr, clientId];
        return next;
      }));
    }
  }

  async function ask() {
    if (!id) return;
    const q = question.trim();
    if (!q) return;
    const nowId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    setAskMessages((prev) => [...prev, { id: nowId + '-u', role: 'user', content: q, ts: Date.now() }]);
    setQuestion('');
    setAsking(true);
    try {
      const res = await fetch(`/api/memos/${id}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error('Ask failed');
      const body = await res.json();
      const a = (body && typeof body.answer === 'string' ? body.answer : '');
      setAskMessages((prev) => [...prev, { id: nowId + '-a', role: 'assistant', content: a, ts: Date.now() }]);
    } catch (e) {
      setAskMessages((prev) => [...prev, { id: nowId + '-a', role: 'assistant', content: 'Sorry, I could not answer that.', ts: Date.now() }]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <Card>
      {!meta ? (
        <div className="p-4">Loading…</div>
      ) : meta.error ? (
        <div className="p-4">Not found</div>
      ) : (
        <>
          {/* Major layout improvement: structured card with clear sections */}
          <CardHeader>
            <CardTitle>Voice memo</CardTitle>
            <CardDescription>Playback, ask questions, and review the transcript.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Two-column layout: main content + right sidebar for comments */}
            <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,38%)] 2xl:grid-cols-[minmax(0,1fr)_minmax(520px,40%)]">
              {/* Main column */}
              <div>
                <AudioBox id="player" controls ref={audioRef} src={`/api/memos/${id}/audio`} onTimeUpdate={(t) => setTime(t)} right={<span className="text-xs text-gray-500 dark:text-gray-400">Server stream</span>} />
                <Separator className="my-4" />
                {transcript.status === 'ready' ? (
                  <div className="space-y-3">
                    <Chapters chapters={transcript.chapters || []} currentTime={time} onSeek={seek} />
                    {null}
                    <div className="rounded-lg border p-3">
                      <Transcript
                        lines={transcript.lines || []}
                        words={transcript.words || []}
                        chapters={transcript.chapters || []}
                        currentTime={time}
                        onSeek={seek}
                        onMouseUp={computeSelectedRange}
                      />
                    </div>
                  </div>
                ) : (
                  <div id="transcript" className="transcript">
                    {transcript.status === 'error' ? 'Transcript unavailable.' : 'Transcribing…'}
                  </div>
                )}
              </div>

              {/* Sidebar column */}
              <aside className="lg:self-stretch">
                <Card className="h-[860px] flex flex-col">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Insights</CardTitle>
                    <CardDescription>Ask or review comments</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {/* Tabs header */}
                    <div className="mb-3 inline-flex w-full rounded-md border p-1 text-sm relative">
                      <div className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded bg-primary/10 pointer-events-none transition-transform duration-200" style={{ transform: activeSidebarTab === 'ask' ? 'translateX(0%)' : 'translateX(100%)' }} />
                      <button
                        className={(activeSidebarTab === 'ask' ? 'bg-primary text-primary-foreground ' : '') + 'relative z-10 rounded px-3 py-1 transition-colors flex-1 text-center focus:outline-none focus-visible:outline-none ring-0 focus:ring-0'}
                        onClick={() => setActiveSidebarTab('ask')}
                        type="button"
                      >
                        Ask
                      </button>
                      <button
                        className={(activeSidebarTab === 'comments' ? 'bg-primary text-primary-foreground ' : '') + 'relative z-10 rounded px-3 py-1 transition-colors flex-1 text-center focus:outline-none focus-visible:outline-none ring-0 focus:ring-0'}
                        onClick={() => setActiveSidebarTab('comments')}
                        type="button"
                      >
                        Comments
                      </button>
                    </div>

                    {/* Ask tab */}
                    {activeSidebarTab === 'ask' ? (
                      <div className="flex flex-1 min-h-0 flex-col">
                        {transcript.status === 'ready' ? (
                          <>
                            <div ref={askScrollRef} className="nice-scroll flex-1 overflow-auto pr-1">
                              {askMessages.length === 0 ? (
                                <div className="flex h-full items-center justify-center py-10">
                                  <div className="text-center text-sm text-muted-foreground">
                                    <MessageSquareText className="mx-auto mb-2 h-6 w-6 opacity-70" />
                                    <div>Ask anything about this memo.</div>
                                    <div className="mt-1">Try “Summarize the last minute.”</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {askMessages.map((m) => (
                                    <ChatMessage key={m.id} message={m} />
                                  ))}
                                  <div ref={askScrollEndRef} />
                                </div>
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-2 self-end w-full">
                              <Input
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder="Ask a question about this memo…"
                                className="flex-1"
                                onKeyDown={(e) => { if ((e as any).key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
                              />
                              <Button onClick={ask} disabled={asking || !question.trim()} variant="secondary">
                                <SendHorizontal className="mr-2 h-4 w-4" /> {asking ? 'Asking…' : 'Ask'}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">Transcript is not ready yet.</div>
                        )}
                      </div>
                    ) : null}

                    {/* Comments tab */}
                    {activeSidebarTab === 'comments' ? (
                      <div className="flex flex-1 min-h-0 flex-col space-y-3">
                        {((commentsByParent.get(null) || []).length === 0) ? (
                          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                            No comments yet. Select transcript text to comment, or add one at the current time.
                          </div>
                        ) : null}
                        <div className="nice-scroll flex-1 overflow-auto pr-1">
                          <CommentThread
                            items={commentsSorted as unknown as CommentItem[]}
                            byParent={commentsByParent as unknown as Map<string | null, CommentItem[]>}
                            onSeek={(t) => seek(t)}
                            onReply={async (parentId, text, t) => {
                              await postComment({ text, parentId, at: typeof t === 'number' ? t : Math.floor(time) });
                            }}
                            onReact={toggleReaction}
                            clientId={clientId}
                          />
                        </div>
                        <div className="relative rounded-lg border border-dashed p-3">
                          {selection ? (
                            <>
                              <button
                                type="button"
                                aria-label="Clear selection"
                                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
                                onClick={() => setSelection(null)}
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <div className="mb-2 text-xs text-muted-foreground">Selected {formatTime(selection.start)}–{formatTime(selection.end)}</div>
                              <div className="mb-2 truncate text-sm">{selection.text.slice(0, 120)}{selection.text.length > 120 ? '…' : ''}</div>
                            </>
                          ) : (
                            <div className="mb-2 text-xs text-muted-foreground">Add a comment at {formatTime(Math.floor(time))}</div>
                          )}
                          <div className="flex items-center gap-2">
                            <AnimatePresence initial={false} mode="wait">
                              {composerEmojiOpen ? (
                                <motion.div
                                  key="emoji-picker"
                                  initial={{ opacity: 0, x: 16, scale: 0.98 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: 16, scale: 0.98 }}
                                  transition={{ duration: 0.18, ease: 'easeOut' }}
                                  className="flex-1 rounded-md border bg-background h-9 px-2"
                                >
                                  <div className="flex h-full items-center gap-2">
                                    {quickEmojis.map((e) => (
                                      <button
                                        key={e}
                                        type="button"
                                        className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-accent"
                                        onClick={async () => {
                                          if (selection) {
                                            await postComment({ text: e, start: selection.start, end: selection.end, quoteText: selection.text });
                                            setSelection(null);
                                          } else {
                                            await postComment({ text: e, at: Math.floor(time) });
                                          }
                                          setComposerEmojiOpen(false);
                                        }}
                                        aria-label={`Add reaction ${e}`}
                                      >
                                        <span className="text-[15px] leading-none">{e}</span>
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              ) : (
                                <motion.div
                                  key="input"
                                  initial={{ opacity: 0, x: -12, scale: 0.98 }}
                                  animate={{ opacity: 1, x: 0, scale: 1 }}
                                  exit={{ opacity: 0, x: -12, scale: 0.98 }}
                                  transition={{ duration: 0.18, ease: 'easeOut' }}
                                  className="flex-1"
                                >
                                  <Input value={commentDrafts['sidebar'] || ''} onChange={(e) => setCommentDrafts((d) => ({ ...d, sidebar: e.target.value }))} placeholder={selection ? 'Comment on selected…' : 'Add a comment…'} className="flex-1" />
                                </motion.div>
                              )}
                            </AnimatePresence>
                            {/* Emoji picker toggle placed before Post */}
                            <Button type="button" variant="ghost" className="h-9 px-2 text-muted-foreground hover:text-foreground" onClick={() => setComposerEmojiOpen((v) => !v)} aria-expanded={composerEmojiOpen} aria-label="Add reaction">
                              <Smile className="h-5 w-5" />
                            </Button>
                            <Button
                              onClick={async () => {
                                const text = (commentDrafts['sidebar'] || '').trim();
                                if (!text) return;
                                if (selection) {
                                  await postComment({ text, start: selection.start, end: selection.end, quoteText: selection.text });
                                  setSelection(null);
                                } else {
                                  await postComment({ text, at: Math.floor(time) });
                                }
                                setCommentDrafts((d) => ({ ...d, sidebar: '' }));
                              }}
                              disabled={!(commentDrafts['sidebar'] || '').trim()}
                            >
                              <MessageCircle className="mr-2 h-4 w-4" /> Post
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </aside>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
};
