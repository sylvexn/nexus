import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { initializeDatabase } from './database/schema'
import { authRoutes } from './routes/auth'
import { uploadRoutes } from './routes/upload'
import { fileRoutes } from './routes/files'
import { adminRoutes } from './routes/admin'
import { CORS_ORIGINS, DEFAULT_PORT } from './config/constants'
import type { HonoContext } from './types'

const app = new Hono<HonoContext>()

app.use('*', logger())

app.use('*', cors({
  origin: (origin, c) => {
    // Allow any localhost origin in development
    if (process.env.NODE_ENV !== 'production') {
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return origin || null
      }
    }
    // In production, use the configured origins
    return CORS_ORIGINS.includes(origin) ? origin : null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposeHeaders: ['Set-Cookie'],
  credentials: true,
}))

const db = initializeDatabase()

app.use('*', async (c, next) => {
  c.set('db', db)
  await next()
})

app.get('/', (c) => {
  return c.json({ 
    message: 'NexusDrop API Server', 
    version: '1.0.0',
    domains: {
      api: 'nx.syl.rest',
      frontend: 'nexus.syl.rest'
    }
  })
})

app.route('/api/auth', authRoutes)
app.route('/api', uploadRoutes)
app.route('/api/files', fileRoutes)
app.route('/api/admin', adminRoutes)
app.route('/f', fileRoutes)

const port = process.env.PORT || DEFAULT_PORT
console.log(`NexusDrop server starting on port ${port}`)

Bun.serve({
  port: Number(port),
  fetch: app.fetch,
}) 