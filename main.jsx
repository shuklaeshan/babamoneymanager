import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import icon from './happy.png'

const link = document.createElement('link')
link.rel = 'icon'
link.href = icon
document.head.appendChild(link)

createRoot(document.getElementById('root')).render(<App />)
