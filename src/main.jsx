import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { MotionConfig } from 'framer-motion'
import { store } from './store'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <Provider store={store}>
        <App />
      </Provider>
    </MotionConfig>
  </StrictMode>,
)
