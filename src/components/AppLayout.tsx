import * as React from 'react';
import { AppHeader } from './AppHeader';
import { motion } from 'framer-motion';

export function AppLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Global header with theme toggle and quick open */}
      <AppHeader />
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="mx-auto max-w-5xl px-4 py-6"
      >
        {children}
      </motion.main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Built with ❤️ by Agam
      </footer>
    </div>
  );
}


