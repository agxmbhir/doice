import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import { RecordPage } from './pages/RecordPage';
import { SharePage } from './pages/SharePage';
import { AppLayout } from './components/AppLayout';

const router = createBrowserRouter([
  { path: '/', element: <AppLayout><RecordPage /></AppLayout> },
  { path: '/s/:id', element: <AppLayout><SharePage /></AppLayout> },
]);

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);


