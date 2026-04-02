import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initWhatsApp } from './whatsapp/connection'
import { startBlastQueue } from './services/blastQueue'
import { apiKeyAuth } from './middleware/auth'
import sendRouter from './routes/send'
import statusRouter from './routes/status'
import chatsRouter from './routes/chats'
import contactsRouter from './routes/contacts'
import templatesRouter from './routes/templates'
import blastRouter from './routes/blast'
import settingsRouter from './routes/settings'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Health check (no auth)
app.get('/health', (_req, res) => res.json({ ok: true }))

// Status has its own auth inline (needed for setup page before API key is known to work)
app.use('/api/status', statusRouter)

// All other API routes require the API key
app.use('/api', apiKeyAuth)
app.use('/api/send', sendRouter)
app.use('/api/chats', chatsRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/blast', blastRouter)
app.use('/api/settings', settingsRouter)

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`)
  initWhatsApp()
  startBlastQueue()
})
