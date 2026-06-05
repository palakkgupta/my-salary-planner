import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import pg from 'pg'

const { Pool } = pg

const app = express()
const PORT = Number(process.env.PORT || 5050)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret'
const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFilePath)
const distDir = path.join(currentDir, 'dist')
const hasClientBuild = fs.existsSync(distDir)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
})

app.use(cors())
app.use(express.json({ limit: '1mb' }))

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS planner_states (
      user_id TEXT PRIMARY KEY,
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

function normalizeEmail(input) {
  if (typeof input !== 'string') {
    return null
  }

  const normalized = input.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (normalized.length > 120 || !normalized.includes('@')) {
    return null
  }

  return normalized
}

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '30d' },
  )
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authentication token' })
    return
  }

  const token = authHeader.slice('Bearer '.length)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = {
      userId: payload.userId,
      email: payload.email,
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Database connection failed' })
  }
})

app.post('/api/auth/register', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email) {
    res.status(400).json({ error: 'Valid email is required' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const user = {
      id: randomUUID(),
      email,
      passwordHash,
    }

    await pool.query(
      'INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)',
      [user.id, user.email, user.passwordHash],
    )

    const token = signToken(user)
    res.status(201).json({
      token,
      user: {
        userId: user.id,
        email: user.email,
      },
    })
  } catch (error) {
    if (error?.code === '23505') {
      res.status(409).json({ error: 'Email already registered' })
      return
    }
    res.status(500).json({ error: 'Registration failed' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    )

    if (result.rowCount === 0) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const user = result.rows[0]
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const token = signToken(user)
    res.json({
      token,
      user: {
        userId: user.id,
        email: user.email,
      },
    })
  } catch {
    res.status(500).json({ error: 'Login failed' })
  }
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    user: {
      userId: req.user.userId,
      email: req.user.email,
    },
  })
})

app.get('/api/planner-state', requireAuth, async (req, res) => {
  const userId = req.user.userId

  try {
    const result = await pool.query(
      'SELECT state, updated_at FROM planner_states WHERE user_id = $1',
      [userId],
    )

    if (result.rowCount === 0) {
      res.json({ userId, state: null })
      return
    }

    res.json({
      userId,
      state: result.rows[0].state,
      updatedAt: result.rows[0].updated_at,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to load planner state' })
  }
})

app.put('/api/planner-state', requireAuth, async (req, res) => {
  const userId = req.user.userId
  const incomingState = req.body?.state

  if (!incomingState || typeof incomingState !== 'object') {
    res.status(400).json({ error: 'state must be an object' })
    return
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO planner_states (user_id, state)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (user_id)
      DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
      RETURNING updated_at
      `,
      [userId, JSON.stringify(incomingState)],
    )

    res.json({ ok: true, userId, updatedAt: result.rows[0].updated_at })
  } catch (error) {
    res.status(500).json({ error: 'Failed to save planner state' })
  }
})

if (hasClientBuild) {
  app.use(express.static(distDir))

  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

async function start() {
  await ensureSchema()

  app.listen(PORT, () => {
    console.log(`Salary Planner server running on port ${PORT}`)
  })
}

start().catch((error) => {
  console.error('Unable to start API server:', error)
  process.exit(1)
})
