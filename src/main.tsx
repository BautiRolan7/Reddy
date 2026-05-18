import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Dashboard from './Dashboard.tsx'
import './index.css'

const isDashboard = window.location.hash === '#dashboard'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDashboard ? <Dashboard /> : <App />}
  </React.StrictMode>,
)
