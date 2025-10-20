import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

export type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string; ts: number };

export function ChatMessage({ message }: { message: ChatMsg }): JSX.Element {
  const isUser = message.role === 'user';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('max-w-[80%] rounded-2xl px-4 py-2', isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
        <div className={cn('mt-1 text-[10px]', isUser ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </motion.div>
  );
}


