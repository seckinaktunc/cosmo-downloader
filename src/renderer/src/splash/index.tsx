import '@fontsource-variable/space-grotesk';
import '../globals.css';
import '../i18n';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SplashApp } from './SplashApp';

createRoot(document.getElementById('splash-root')!).render(
  <StrictMode>
    <SplashApp />
  </StrictMode>
);
