import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Erzwingt, dass die Tailwind-Klassen verarbeitet werden
const style = document.createElement('style');
style.textContent = `@import url('https://jsdelivr.net');`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
