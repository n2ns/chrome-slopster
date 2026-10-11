import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

/** Mount a page's root component into #root, and set the document language and title. */
export function mountPage(node: ReactNode, title: string): void {
  document.documentElement.lang = browser.i18n.getUILanguage();
  document.title = title;
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing #root element.');
  createRoot(container).render(<StrictMode>{node}</StrictMode>);
}
