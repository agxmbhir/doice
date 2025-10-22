import * as React from 'react';
import { Button } from './ui/button';
import { Download, Loader2 } from 'lucide-react';

type LineLike = { text: string };

export interface DownloadTranscriptButtonProps {
  resolveLines: () => Promise<LineLike[]> | LineLike[];
  filename?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'icon';
  variant?: 'default' | 'secondary' | 'destructive' | 'ghost' | 'outline' | 'link';
  disabled?: boolean;
  label?: string;
  iconOnly?: boolean;
}

function toText(lines: LineLike[]): string {
  const content = (Array.isArray(lines) ? lines : [])
    .map((l) => (typeof l?.text === 'string' ? l.text.trim() : ''))
    .filter((t) => t.length > 0)
    .join('\n');
  return content || 'Transcript unavailable';
}

function triggerDownload(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'transcript.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const DownloadTranscriptButton: React.FC<DownloadTranscriptButtonProps> = ({
  resolveLines,
  filename = 'transcript.txt',
  className,
  size = 'sm',
  variant = 'ghost',
  disabled,
  label = 'Download',
  iconOnly = false,
}) => {
  const [loading, setLoading] = React.useState(false);
  return (
    <Button
      type="button"
      size={(iconOnly ? 'icon' : size) as any}
      variant={variant as any}
      className={className}
      disabled={disabled || loading}
      onClick={async () => {
        try {
          setLoading(true);
          const lines = await Promise.resolve(resolveLines());
          const text = toText(lines || []);
          triggerDownload(filename, text);
        } finally {
          setLoading(false);
        }
      }}
      aria-label="Download transcript"
   >
      {loading ? <Loader2 className={iconOnly ? 'h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} /> : <Download className={iconOnly ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />}
      {iconOnly ? null : (loading ? 'Preparing…' : label)}
    </Button>
  );
};

export default DownloadTranscriptButton;


