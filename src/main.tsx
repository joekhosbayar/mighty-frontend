import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { configureAuth } from './core/auth';
import './styles.css'

import { appStore } from './store'

configureAuth();
appStore().getState().initSession();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
