import { Router } from 'express'
import QRCode from 'qrcode'
import { qrCode, connectionStatus, logout } from '../whatsapp/connection'
import { apiKeyAuth } from '../middleware/auth'

const router = Router()

router.get('/', apiKeyAuth, async (_req, res) => {
  let qrDataUrl: string | null = null

  if (qrCode) {
    try {
      qrDataUrl = await QRCode.toDataURL(qrCode)
    } catch {
      // ignore QR render errors
    }
  }

  res.json({ status: connectionStatus, qr: qrDataUrl })
})

router.post('/logout', apiKeyAuth, async (_req, res) => {
  await logout()
  res.json({ ok: true })
})

export default router
