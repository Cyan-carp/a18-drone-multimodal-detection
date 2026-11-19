import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import { ThemeProvider, useTheme } from './lib/theme'
import './index.css'

function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'rgb(var(--pg-surface))',
          border: '1px solid rgb(var(--pg-border))',
          color: 'rgb(var(--pg-text))',
          borderRadius: '12px',
          fontSize: '13px',
        },
      }}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
        <ThemedToaster />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
)
