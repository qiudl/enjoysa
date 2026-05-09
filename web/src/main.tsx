import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.tsx'
import { installChunkSelfHeal } from './chunkSelfHeal'

// REQ-20260509-0025: 部署后已打开的 tab 触发 lazy import 时拉旧 hash chunk
// 必 404，React 整页崩溃；自动 reload 一次拉新 bundle。
installChunkSelfHeal()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
