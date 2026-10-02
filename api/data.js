import { createHash } from 'node:crypto'

const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
const P = 'bmm:'
const BUCKETS = ['home', 'eshan', 'niharika']

const hash = (pin) => createHash('sha256').update(`babas-money-manager:${pin}`).digest('hex')

async function redis(...cmd) {
  const r = await fetch(DB_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  })
  const j = await r.json()
  if (j.error) throw new Error(j.error)
  return j.result
}

const validExpense = (e) =>
  e && typeof e.id === 'string' && Number(e.amount) > 0 && BUCKETS.includes(e.bucket) && /^\d{4}-\d{2}-\d{2}$/.test(e.date)

const cleanExpense = (e) => ({
  id: e.id.slice(0, 64),
  createdAt: Number(e.createdAt) || Date.now(),
  amount: Number(e.amount),
  bucket: e.bucket,
  note: String(e.note || '').slice(0, 200),
  date: e.date,
})

const cleanLimits = (l = {}) => Object.fromEntries(BUCKETS.map((b) => [b, Math.max(Number(l[b]) || 0, 0)]))

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!DB_URL || !DB_TOKEN) return res.status(500).json({ error: 'The database is not connected yet.' })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const storedPin = await redis('GET', P + 'pin')

    // First-time setup: whoever opens the app first creates the family PIN
    if (req.method === 'POST' && body.action === 'setup') {
      if (storedPin) return res.status(409).json({ error: 'A PIN already exists. Please enter it instead.' })
      const pin = String(body.pin || '')
      if (!/^\d{4,8}$/.test(pin)) return res.status(400).json({ error: 'Please use 4 to 8 digits.' })
      await redis('SET', P + 'pin', hash(pin), 'NX')
      return res.json({ ok: true })
    }
    if (!storedPin) return res.json({ needsSetup: true })

    const fails = Number((await redis('GET', P + 'fails')) || 0)
    if (fails >= 10) return res.status(429).json({ error: 'Too many tries. Please wait 15 minutes.' })
    if (hash(String(req.headers['x-pin'] || '')) !== storedPin) {
      await redis('INCR', P + 'fails')
      await redis('EXPIRE', P + 'fails', 900)
      return res.status(401).json({ error: "That PIN did not match. Try again." })
    }

    if (req.method === 'GET') {
      const [limits, all] = await Promise.all([redis('GET', P + 'limits'), redis('HGETALL', P + 'expenses')])
      const expenses = []
      for (let i = 1; i < (all || []).length; i += 2) {
        try {
          expenses.push(JSON.parse(all[i]))
        } catch {
          /* skip bad row */
        }
      }
      return res.json({ limits: limits ? JSON.parse(limits) : null, expenses })
    }

    if (req.method === 'POST') {
      if (body.action === 'save' || body.action === 'import') {
        const list = (body.expenses || []).filter(validExpense).map(cleanExpense)
        if (list.length) await redis('HSET', P + 'expenses', ...list.flatMap((e) => [e.id, JSON.stringify(e)]))
        if (body.action === 'import' && body.limits)
          await redis('SET', P + 'limits', JSON.stringify(cleanLimits(body.limits)), 'NX')
        return res.json({ ok: true })
      }
      if (body.action === 'delete') {
        await redis('HDEL', P + 'expenses', String(body.id))
        return res.json({ ok: true })
      }
      if (body.action === 'limits') {
        await redis('SET', P + 'limits', JSON.stringify(cleanLimits(body.limits)))
        return res.json({ ok: true })
      }
    }
    return res.status(400).json({ error: 'Unknown request' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
