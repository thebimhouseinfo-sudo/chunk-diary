import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyBrowserClassToHtml } from './utils/browser';

// Gắn class browser-safari lên <html> TRƯỚC khi render, để tránh nháy layout (FOUC)
applyBrowserClassToHtml();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
