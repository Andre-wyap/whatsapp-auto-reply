import { Request, Response, NextFunction } from 'express'

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || header !== `Bearer ${process.env.API_KEY}`) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
