import * as React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { AudioLines, Share2 } from 'lucide-react';

export function AppHeader(): JSX.Element {
  const [memoId, setMemoId] = React.useState('');
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/70">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="group inline-flex items-center gap-2">
          <AudioLines className="h-5 w-5 text-blue-600" />
          <span className="text-base font-semibold tracking-tight">Doice</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/" className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">Record</Link>
          <div className="hidden items-center gap-2 sm:flex">
            <Input
              placeholder="Open memo ID…"
              value={memoId}
              onChange={(e) => setMemoId(e.target.value)}
              className="w-40"
              aria-label="Memo ID"
            />
            <Button size="sm" variant="secondary" onClick={() => memoId && navigate(`/s/${memoId}`)}>
              <Share2 className="mr-1 h-4 w-4" /> Open
            </Button>
          </div>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}


