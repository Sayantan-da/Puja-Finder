import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import transitRoutes from './routes/transitRoutes'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Kolkata Festival Transport API', timestamp: new Date().toISOString() })
})

// Transit & Guide API v1 routes
app.use('/api/v1', transitRoutes)

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚇 Kolkata Metro & Festival Transport Service running on port ${PORT}`)
  })
}

export default app
