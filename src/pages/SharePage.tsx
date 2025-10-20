import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { MessageCircle, SendHorizontal, X } from 'lucide-react';
import { AudioBox } from '../components/AudioBox';

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
    <div id="chapters" className="chapters">
      {chapters.map((c, i) => (
        <button key={i} className={currentTime >= c.start && currentTime <= c.end ? 'chapter active' : 'chapter'} onClick={() => onSeek(c.start)}>
          {c.title}
        </button>
      ))}
    </div>
  );
}

function Transcript({ lines, words, currentTime, onSeek, onMouseUp, selectedRange }: { lines: Line[]; words: Word[]; currentTime: number; onSeek: (t: number) => void; onMouseUp?: () => void; selectedRange?: { from: number; to: number } | null }) {
  return (
    <div id="transcript" className="space-y-2" onMouseUp={onMouseUp}>
      {lines.map((line, idxLine) => (
        <div
          key={idxLine}
          className={currentTime >= line.start && currentTime <= line.end ? 'rounded-md bg-blue-50/60 px-3 py-2 dark:bg-blue-950/30' : 'rounded-md px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900'}
          onClick={() => onSeek(line.start)}
        >
          {words.slice(line.from, line.to + 1).map((w, idxWord) => {
            const globalIdx = line.from + idxWord;
            const active = currentTime >= w.start && currentTime <= w.end;
            const inSel = selectedRange && globalIdx >= selectedRange.from && globalIdx <= selectedRange.to;
            return (
              <span
                key={`${idxLine}-${idxWord}`}
                data-word-idx={globalIdx}
                className={(inSel ? 'bg-yellow-200 dark:bg-yellow-800 ' : '') + (active ? 'text-blue-600 dark:text-blue-400 ' : '')}
                onClick={(e) => { e.stopPropagation(); onSeek(w.start); }}
              >
                {w.text}
                {idxWord < line.to - line.from ? ' ' : ''}
              </span>
            );
          })}
        </div>
      ))}
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
  const [comments, setComments] = useState<Array<{ id: string; parentId: string | null; at?: number; lineIndex?: number; text: string; createdAt: number }>>([]);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<{ from: number; to: number; start: number; end: number; text: string } | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'ask' | 'comments'>('ask');
  const [askMessages, setAskMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; ts: number }>>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

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
        setComments(Array.isArray(body.comments) ? body.comments : []);
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
    const withTime = comments.map((c: any) => ({ ...c, t: typeof c.start === 'number' ? c.start : (typeof c.at === 'number' ? c.at : (typeof c.lineIndex === 'number' ? (transcript.lines?.[c.lineIndex]?.start ?? 0) : 0)) }));
    withTime.sort((a, b) => a.t - b.t);
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

  async function postComment(partial: { text: string; parentId?: string | null; at?: number; lineIndex?: number; start?: number; end?: number }) {
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
            <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
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
                        currentTime={time}
                        onSeek={seek}
                        onMouseUp={computeSelectedRange}
                        selectedRange={selection ? { from: selection.from, to: selection.to } : null}
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
              <aside className="lg:sticky lg:top-24 lg:h-fit">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Insights</CardTitle>
                    <CardDescription>Ask or review comments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Tabs header */}
                    <div className="mb-3 inline-flex rounded-md border p-1 text-sm">
                      <button
                        className={(activeSidebarTab === 'ask' ? 'bg-primary text-primary-foreground ' : '') + 'rounded px-3 py-1 transition-colors'}
                        onClick={() => setActiveSidebarTab('ask')}
                        type="button"
                      >
                        Ask
                      </button>
                      <button
                        className={(activeSidebarTab === 'comments' ? 'bg-primary text-primary-foreground ' : '') + 'ml-1 rounded px-3 py-1 transition-colors'}
                        onClick={() => setActiveSidebarTab('comments')}
                        type="button"
                      >
                        Comments
                      </button>
                    </div>

                    {/* Ask tab */}
                    {activeSidebarTab === 'ask' ? (
                      <div className="space-y-3">
                        {transcript.status === 'ready' ? (
                          <>
                            <div className="flex gap-2">
                              <Input
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder="Ask a question about this memo…"
                                className="w-full"
                                onKeyDown={(e) => { if ((e as any).key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
                              />
                              <Button onClick={ask} disabled={asking || !question.trim()} variant="secondary">
                                <SendHorizontal className="mr-2 h-4 w-4" /> {asking ? 'Asking…' : 'Ask'}
                              </Button>
                            </div>
                            <div className="max-h-80 space-y-2 overflow-auto pr-1">
                              {askMessages.map((m) => (
                                <div key={m.id} className={(m.role === 'user' ? 'ml-8 rounded-lg bg-primary/10 p-2' : 'mr-8 rounded-lg border p-2 dark:border-gray-800') + ' text-sm'}>
                                  {m.content}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-muted-foreground">Transcript is not ready yet.</div>
                        )}
                      </div>
                    ) : null}

                    {/* Comments tab */}
                    {activeSidebarTab === 'comments' ? (
                      <div className="space-y-3">
                        {selection ? (
                          <div className="relative rounded-lg border border-dashed p-3">
                            <button
                              type="button"
                              aria-label="Clear selection"
                              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-accent"
                              onClick={() => setSelection(null)}
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <div className="mb-2 text-xs text-muted-foreground">Selected {formatTime(selection.start)}–{formatTime(selection.end)}</div>
                            <div className="mb-2 truncate text-sm">“{selection.text.slice(0, 120)}{selection.text.length > 120 ? '…' : ''}”</div>
                            <div className="flex gap-2">
                              <Input value={commentDrafts['selection'] || ''} onChange={(e) => setCommentDrafts((d) => ({ ...d, selection: e.target.value }))} placeholder="Comment on selected…" />
                              <Button
                                onClick={async () => {
                                  const text = (commentDrafts['selection'] || '').trim();
                                  if (!text) return;
                                  await postComment({ text, start: selection.start, end: selection.end });
                                  setCommentDrafts((d) => ({ ...d, selection: '' }));
                                  setSelection(null);
                                }}
                                disabled={!(commentDrafts['selection'] || '').trim()}
                              >
                                <MessageCircle className="mr-2 h-4 w-4" /> Post
                              </Button>
                            </div>
                          </div>
                        ) : null}
                        {(commentsByParent.get(null) || []).map((c) => (
                          <div key={c.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                              {'start' in (c as any) && typeof (c as any).start === 'number' && typeof (c as any).end === 'number' ? (
                                <button className="underline" onClick={() => seek((c as any).start)}>
                                  {formatTime(Math.floor((c as any).start))}–{formatTime(Math.floor((c as any).end))}
                                </button>
                              ) : (
                                <button className="underline" onClick={() => seek((c as any).t || 0)}>{formatTime(Math.floor((c as any).t || 0))}</button>
                              )}
                              <span>{new Date((c as any).createdAt).toLocaleString()}</span>
                            </div>
                            <div className="whitespace-pre-wrap">{c.text}</div>
                            <div className="mt-2">
                              {replyDrafts[c.id] === undefined ? (
                                <Button size="sm" variant="ghost" onClick={() => setReplyDrafts((d) => ({ ...d, [c.id]: '' }))}>Reply</Button>
                              ) : (
                                <div className="flex gap-2">
                                  <Input value={replyDrafts[c.id] || ''} onChange={(e) => setReplyDrafts((d) => ({ ...d, [c.id]: e.target.value }))} placeholder="Write a reply…" />
                                  <Button
                                    onClick={async () => {
                                      const text = (replyDrafts[c.id] || '').trim();
                                      if (!text) return;
                                      await postComment({ text, parentId: c.id, at: (c as any).t });
                                      setReplyDrafts((d) => { const nd = { ...d }; delete nd[c.id]; return nd; });
                                    }}
                                    disabled={!(replyDrafts[c.id] || '').trim()}
                                  >
                                    <MessageCircle className="mr-2 h-4 w-4" /> Post
                                  </Button>
                                  <Button variant="ghost" onClick={() => setReplyDrafts((d) => { const nd = { ...d }; delete nd[c.id]; return nd; })}>Cancel</Button>
                                </div>
                              )}
                            </div>
                            {(commentsByParent.get(c.id) || []).map((r) => (
                              <div key={r.id} className="mt-3 rounded-lg border bg-background p-3 pl-4 text-sm dark:border-gray-800">
                                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                                  {'start' in (r as any) && typeof (r as any).start === 'number' && typeof (r as any).end === 'number' ? (
                                    <button className="underline" onClick={() => seek((r as any).start)}>
                                      {formatTime(Math.floor((r as any).start))}–{formatTime(Math.floor((r as any).end))}
                                    </button>
                                  ) : (
                                    <button className="underline" onClick={() => seek((r as any).t || 0)}>{formatTime(Math.floor((r as any).t || 0))}</button>
                                  )}
                                  <span>{new Date((r as any).createdAt).toLocaleString()}</span>
                                </div>
                                <div className="whitespace-pre-wrap">{r.text}</div>
                              </div>
                            ))}
                          </div>
                        ))}
                        <div className="rounded-lg border border-dashed p-3">
                          <div className="mb-2 text-xs text-muted-foreground">Add a comment at {formatTime(Math.floor(time))}</div>
                          <div className="flex gap-2">
                            <Input value={commentDrafts['sidebar'] || ''} onChange={(e) => setCommentDrafts((d) => ({ ...d, sidebar: e.target.value }))} placeholder="Add a comment…" />
                            <Button
                              onClick={async () => {
                                const text = (commentDrafts['sidebar'] || '').trim();
                                if (!text) return;
                                await postComment({ text, at: Math.floor(time) });
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
