import { useEffect, useMemo, useRef, useState } from 'react'
import usPhoto from './us.jpg'
import { makeDailyReport, makeMonthlyReport } from './reports.js'

const IMAGES = import.meta.glob('./*.png', { eager: true, import: 'default' })
const pic = (name) => IMAGES[`./${name}.png`]

const LOVE_NOTES = [
  'Love is choosing the same person on ordinary Tuesdays, not just on special days.',
  'Hold hands a little longer today. Small touches say big things.',
  'The best conversations happen over chai, with nowhere else to be.',
  'Be each other’s soft place to land after a long day.',
  'Laughing at the same silly things is the sweetest glue two hearts can have.',
  'Say thank you for the little things. They are never really little.',
  'Some days one of you carries more. Love is taking turns without keeping score.',
  'Look at each other the way you do in this photo. That spark is still right there.',
  'Ask “how was your day, really?” and then listen to every word.',
  'A hug that lasts twenty seconds can fix more than you think.',
  'Growing together means cheering for each other’s dreams like they’re your own.',
  'Forgive quickly, hug often, and never sleep with a heavy heart.',
  'Home is wherever the two of you are being silly together.',
  'Leave a sweet note somewhere unexpected. Tiny surprises keep love young.',
  'Stay curious about each other forever. There is always more to discover.',
  'On hard days, it’s the two of you against the problem, never against each other.',
  'Plan a tiny adventure this week, even if it’s just a new street to walk down.',
  'The way you speak to each other becomes the voice in each other’s heart. Keep it kind.',
  'Celebrate the small wins together. Each one is a little love story.',
  'Bade Baba and Chota Baba: two hearts, one team, endless cuddles.',
  'Dance in the kitchen tonight. No music needed.',
  'Say “I’m proud of you” out loud today. Hearts grow when they hear it.',
  'Patience is love that’s willing to wait for the best in each other.',
  'Make the kind of memories you’ll smile about when you’re old and still holding hands.',
  'Every rupee you plan together is a little brick in the home you’re building.',
  'Some months are tight. You two are tighter.',
  'A late-night chai split two ways still counts as a date.',
  'Saying “I spent a bit much” out loud is brave. Hearing it gently is love.',
]
const randomNote = () => LOVE_NOTES[Math.floor(Math.random() * LOVE_NOTES.length)]

const STORAGE_KEY = 'spiko-budget-v1'

const BUCKETS = [
  { id: 'home', label: 'Home', hint: 'Household', color: '#2E7D32', soft: '#DCEBD9', pic: 'hoodie' },
  { id: 'eshan', label: 'Bade Baba', hint: 'Pocket money', color: '#6B4B3E', soft: '#EADBCF', pic: 'beanie' },
  { id: 'niharika', label: 'Chota Baba', hint: 'Pocket money', color: '#C27A8C', soft: '#F3DDE2', pic: 'music' },
]

const DEFAULT_DATA = {
  limits: { home: 50000, eshan: 20000, niharika: 20000 },
  expenses: [],
}

const rupee = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
const fmt = (n) => rupee.format(Math.round(n || 0))
const fmtShort = (n) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `₹${Math.round(n)}`
}
const newItem = (bucket) => ({ key: Math.random().toString(36).slice(2), amount: '', bucket, note: '' })

const pad = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayISO = () => toISO(new Date())
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DATA
    const parsed = JSON.parse(raw)
    return {
      limits: { ...DEFAULT_DATA.limits, ...(parsed.limits || {}) },
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    }
  } catch {
    return DEFAULT_DATA
  }
}

function prettyDay(iso) {
  const t = todayISO()
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (iso === t) return 'Today'
  if (iso === toISO(y)) return 'Yesterday'
  const [yy, mm, dd] = iso.split('-').map(Number)
  return new Date(yy, mm - 1, dd).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

// ---------- Sync between phones ----------
const PIN_KEY = 'bmm-pin'
const QUEUE_KEY = 'bmm-queue'
const MIGRATED_KEY = 'bmm-migrated'

const store = {
  get(k) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
  del(k) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  },
}

async function api(method, body, pin) {
  let res
  try {
    res = await fetch('/api/data', {
      method,
      headers: { 'Content-Type': 'application/json', ...(pin ? { 'x-pin': pin } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw Object.assign(new Error('offline'), { offline: true })
  }
  const type = res.headers.get('content-type') || ''
  if (!type.includes('application/json')) throw Object.assign(new Error('no-api'), { noApi: true })
  const json = await res.json()
  if (res.status === 401 || res.status === 429) throw Object.assign(new Error(json.error), { badPin: true })
  if (!res.ok) throw new Error(json.error || 'Something went wrong')
  return json
}

function applyOp(d, op) {
  if (op.action === 'save' || op.action === 'import') {
    const expenses = [...d.expenses]
    op.expenses.forEach((exp) => {
      const i = expenses.findIndex((e) => e.id === exp.id)
      if (i >= 0) expenses[i] = exp
      else expenses.push(exp)
    })
    return { ...d, expenses }
  }
  if (op.action === 'delete') return { ...d, expenses: d.expenses.filter((e) => e.id !== op.id) }
  if (op.action === 'limits') return { ...d, limits: op.limits }
  return d
}

const loadQueue = () => {
  try {
    return JSON.parse(store.get(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

export default function App() {
  const [data, setData] = useState(loadData)
  // 'checking' | 'local' | 'setup' | 'locked' | 'synced'
  const [syncMode, setSyncMode] = useState('checking')
  const [pinError, setPinError] = useState('')
  const [pending, setPending] = useState(() => loadQueue().length)
  const pinRef = useRef(store.get(PIN_KEY))
  const queueRef = useRef(loadQueue())
  const flushing = useRef(false)

  function saveQueue() {
    store.set(QUEUE_KEY, JSON.stringify(queueRef.current))
    setPending(queueRef.current.length)
  }

  async function flush() {
    if (flushing.current) return
    flushing.current = true
    try {
      while (queueRef.current.length) {
        await api('POST', queueRef.current[0], pinRef.current)
        queueRef.current = queueRef.current.slice(1)
        saveQueue()
      }
    } catch (e) {
      if (e.badPin) {
        store.del(PIN_KEY)
        pinRef.current = null
        setSyncMode('locked')
      }
    } finally {
      flushing.current = false
    }
  }

  async function refresh() {
    if (!pinRef.current) return
    try {
      const remote = await api('GET', null, pinRef.current)
      if (remote.needsSetup) return setSyncMode('setup')
      setData((d) =>
        queueRef.current.reduce(applyOp, {
          limits: { ...d.limits, ...(remote.limits || {}) },
          expenses: remote.expenses,
        })
      )
      setSyncMode('synced')
      flush()
    } catch (e) {
      if (e.badPin) {
        store.del(PIN_KEY)
        pinRef.current = null
        setSyncMode('locked')
      } else if (e.noApi) setSyncMode('local')
      else setSyncMode('synced') // offline: keep showing this phone's copy
    }
  }

  // First check: is the shared database there, and does this phone know the PIN?
  useEffect(() => {
    ;(async () => {
      try {
        const res = await api('GET', null, pinRef.current)
        if (res.needsSetup) return setSyncMode('setup')
        await refresh()
      } catch (e) {
        if (e.badPin) setSyncMode('locked')
        else if (e.noApi) setSyncMode('local')
        else setSyncMode(pinRef.current ? 'synced' : 'local')
      }
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Pick up the other phone's changes
  useEffect(() => {
    if (syncMode !== 'synced') return
    const tick = () => document.visibilityState === 'visible' && refresh()
    const id = setInterval(tick, 20000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('online', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('online', tick)
    }
  }, [syncMode]) // eslint-disable-line react-hooks/exhaustive-deps

  function commit(op) {
    setData((d) => applyOp(d, op))
    if (syncMode === 'synced') {
      queueRef.current = [...queueRef.current, op]
      saveQueue()
      flush()
    }
  }

  async function unlock(pin, isSetup) {
    setPinError('')
    try {
      if (isSetup) await api('POST', { action: 'setup', pin })
      await api('GET', null, pin)
      pinRef.current = pin
      store.set(PIN_KEY, pin)
      // First time on this phone: send up whatever was saved here before syncing existed
      if (!store.get(MIGRATED_KEY)) {
        if (data.expenses.length) {
          queueRef.current = [
            { action: 'import', expenses: data.expenses, limits: data.limits },
            ...queueRef.current,
          ]
          saveQueue()
        }
        store.set(MIGRATED_KEY, '1')
      }
      await flush()
      await refresh()
    } catch (e) {
      setPinError(e.badPin ? e.message || 'That PIN didn’t match. Try again.' : e.message)
    }
  }
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [sheet, setSheet] = useState(null) // null | {mode:'add'} | {mode:'edit', expense} | {mode:'limits'}
  const [filter, setFilter] = useState('all')
  const [selectedDay, setSelectedDay] = useState(null)
  const [celebrate, setCelebrate] = useState(null)
  const celebrateTimer = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* storage unavailable, app keeps working in memory */
    }
  }, [data])

  const mKey = monthKey(viewMonth)
  const isCurrentMonth = mKey === monthKey(new Date())

  const monthExpenses = useMemo(
    () =>
      data.expenses
        .filter((e) => e.date.startsWith(mKey))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [data.expenses, mKey]
  )

  const spent = useMemo(() => {
    const s = { home: 0, eshan: 0, niharika: 0 }
    monthExpenses.forEach((e) => (s[e.bucket] += Number(e.amount)))
    return s
  }, [monthExpenses])

  const totalLimit = BUCKETS.reduce((a, b) => a + Number(data.limits[b.id] || 0), 0)
  const totalSpent = spent.home + spent.eshan + spent.niharika

  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate()
  const dayOfMonth = isCurrentMonth ? new Date().getDate() : daysInMonth
  const daysLeft = Math.max(daysInMonth - dayOfMonth + 1, 1)

  // Spiko's mood follows how spending is pacing against the month
  const mood = useMemo(() => {
    if (celebrate) return 'cheer'
    if (monthExpenses.length === 0) return 'sleepy'
    const usedPct = totalLimit ? totalSpent / totalLimit : 0
    const timePct = dayOfMonth / daysInMonth
    const anyOver = BUCKETS.some((b) => spent[b.id] > data.limits[b.id])
    if (anyOver || usedPct > 1) return 'surprised'
    if (usedPct > timePct * 1.1) return 'curious'
    if (usedPct < timePct * 0.75) return 'joyful'
    return 'happy'
  }, [celebrate, monthExpenses.length, totalSpent, totalLimit, dayOfMonth, daysInMonth, spent, data.limits])

  const moodLine = {
    sleepy: 'Add your first expense and I will keep watch.',
    joyful: 'You are spending gently this month. Lovely!',
    happy: 'Right on pace. Everything looks cosy.',
    curious: 'Spending is a little ahead of the month. Worth a peek.',
    surprised: 'One budget has gone past its limit. Let\u2019s take a look together.',
    cheer: celebrate,
  }[mood]

  function saveExpenses(list) {
    commit({ action: 'save', expenses: list })
    setSheet(null)
    const total = list.reduce((a, e) => a + Number(e.amount), 0)
    const msg =
      list.length === 1
        ? `Saved ${fmt(total)} to ${BUCKETS.find((b) => b.id === list[0].bucket).label}.`
        : `Saved ${list.length} items, ${fmt(total)} in all.`
    setCelebrate(msg)
    clearTimeout(celebrateTimer.current)
    celebrateTimer.current = setTimeout(() => setCelebrate(null), 2600)
  }

  function deleteExpense(id) {
    commit({ action: 'delete', id })
    setSheet(null)
  }

  function saveLimits(limits) {
    commit({ action: 'limits', limits })
    setSheet(null)
  }

  function shiftMonth(delta) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
    setSelectedDay(null)
  }

  const listed = monthExpenses.filter(
    (e) => (filter === 'all' || e.bucket === filter) && (!selectedDay || e.date === selectedDay)
  )
  const bucketLabel = filter === 'all' ? '' : BUCKETS.find((b) => b.id === filter).label + ' '
  const grouped = listed.reduce((acc, e) => {
    ;(acc[e.date] = acc[e.date] || []).push(e)
    return acc
  }, {})

  if (syncMode === 'setup' || syncMode === 'locked') {
    return <PinScreen setup={syncMode === 'setup'} error={pinError} onSubmit={unlock} />
  }

  return (
    <div className="app">
      <h1 className="brand">
        <img src={pic('leaf')} alt="" aria-hidden="true" className="brand-leaf left" />
        Baba’s Money Manager
        <img src={pic('leaf')} alt="" aria-hidden="true" className="brand-leaf right" />
      </h1>
      <UsCard />
      {syncMode === 'synced' && (
        <p className={`sync-pill ${pending ? 'waiting' : ''}`}>
          {pending ? `${pending} change${pending > 1 ? 's' : ''} waiting to sync` : 'Shared between your phones'}
        </p>
      )}
      <header className="hero">
        <div className="month-switch">
          <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            ‹
          </button>
          <span className="month-name">
            {viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <button
            className="icon-btn"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            disabled={isCurrentMonth}
          >
            ›
          </button>
        </div>

        <div className="hero-body">
          <div className="spiko-wrap">
            <img key={mood} className={`spiko-mood ${celebrate ? 'hop' : ''}`} src={pic(mood)} alt={`Mascot looking ${mood}`} />
            {celebrate && <Burst />}
          </div>
          <div className="hero-text">
            <p className="bubble" key={moodLine}>
              {moodLine}
            </p>
            <p className="total-spent">{fmt(totalSpent)}</p>
            <p className="total-of">spent of {fmt(totalLimit)}</p>
          </div>
        </div>
      </header>

      <section className="buckets" aria-label="Budgets">
        {BUCKETS.map((b) => {
          const limit = Number(data.limits[b.id] || 0)
          const used = spent[b.id]
          const pct = limit ? Math.min(used / limit, 1) : 0
          const left = limit - used
          const active = filter === b.id
          return (
            <button
              key={b.id}
              className={`bucket ${active ? 'active' : ''}`}
              style={{ '--c': b.color, '--soft': b.soft }}
              onClick={() => setFilter(active ? 'all' : b.id)}
              aria-pressed={active}
            >
              <img
                className="bucket-pic"
                src={pic(left < 0 ? 'surprised' : b.pic)}
                alt=""
                aria-hidden="true"
              />
              <span className="bucket-top">
                <span className="bucket-name">{b.label}</span>
                <span className="bucket-hint">{b.hint}</span>
              </span>
              <span className="bucket-spent">{fmt(used)}</span>
              <span className="bar">
                <span className="bar-fill" style={{ width: `${pct * 100}%` }} />
              </span>
              <span className={`bucket-left ${left < 0 ? 'over' : ''}`}>
                {left >= 0 ? `${fmt(left)} left of ${fmt(limit)}` : `${fmt(-left)} over ${fmt(limit)}`}
              </span>
            </button>
          )
        })}
        <button className="link-btn" onClick={() => setSheet({ mode: 'limits' })}>
          Edit limits
        </button>
      </section>

      <Insights
        monthExpenses={monthExpenses}
        spent={spent}
        limits={data.limits}
        daysLeft={daysLeft}
        dayOfMonth={dayOfMonth}
        isCurrentMonth={isCurrentMonth}
        totalSpent={totalSpent}
      />

      <Calendar
        viewMonth={viewMonth}
        monthExpenses={monthExpenses}
        selectedDay={selectedDay}
        onSelect={(iso) => setSelectedDay(selectedDay === iso ? null : iso)}
      />

      <Reports
        day={selectedDay || (isCurrentMonth ? todayISO() : null)}
        viewMonth={viewMonth}
        expenses={data.expenses}
        limits={data.limits}
      />

      <section className="list-section">
        <div className="list-head">
          <h2>
            {selectedDay
              ? `${bucketLabel}${prettyDay(selectedDay)}`
              : `${bucketLabel}${bucketLabel ? 'expenses' : 'Expenses'}`}
          </h2>
          {selectedDay && (
            <button className="link-btn" onClick={() => setSelectedDay(null)}>
              Show whole month
            </button>
          )}
        </div>
        {listed.length === 0 ? (
          <div className="empty">
            <img src={pic('cozy')} alt="" />
            <p>
              {selectedDay
                ? 'Nothing spent on this day. Tap “Add expense” to add items for it.'
                : 'Nothing here yet. Tap “Add expense” to log your first one.'}
            </p>
          </div>
        ) : (
          Object.entries(grouped).map(([day, items]) => (
            <div className="day" key={day}>
              <div className="day-head">
                <span>{prettyDay(day)}</span>
                <span>{fmt(items.reduce((a, e) => a + Number(e.amount), 0))}</span>
              </div>
              {items.map((e) => {
                const b = BUCKETS.find((x) => x.id === e.bucket)
                return (
                  <button
                    key={e.id}
                    className="row"
                    onClick={() => setSheet({ mode: 'edit', expense: e })}
                  >
                    <span className="dot" style={{ background: b.color }} />
                    <span className="row-text">
                      <span className="row-note">{e.note || b.hint}</span>
                      <span className="row-bucket">{b.label}</span>
                    </span>
                    <span className="row-amt">{fmt(e.amount)}</span>
                  </button>
                )
              })}
            </div>
          ))
        )}
      </section>

      <button className="add-fab" onClick={() => setSheet({ mode: 'add' })}>
        <span aria-hidden="true">+</span> Add expense
      </button>

      {sheet && sheet.mode === 'add' && (
        <AddItemsSheet
          defaultBucket={filter === 'all' ? 'home' : filter}
          defaultDate={selectedDay || todayISO()}
          onSave={saveExpenses}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheet.mode === 'edit' && (
        <ExpenseSheet
          initial={sheet.expense}
          defaultBucket={sheet.expense.bucket}
          onSave={(exp) => saveExpenses([exp])}
          onDelete={deleteExpense}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet && sheet.mode === 'limits' && (
        <LimitsSheet limits={data.limits} onSave={saveLimits} onClose={() => setSheet(null)} />
      )}
    </div>
  )
}

function Insights({ monthExpenses, spent, limits, daysLeft, dayOfMonth, isCurrentMonth, totalSpent }) {
  if (monthExpenses.length === 0) return null

  const dailyAvg = totalSpent / Math.max(dayOfMonth, 1)
  const biggest = monthExpenses.reduce((a, e) => (Number(e.amount) > Number(a.amount) ? e : a))
  const bigBucket = BUCKETS.find((b) => b.id === biggest.bucket)

  return (
    <section className="insights">
      <h2 className="with-pic">
        <img src={pic('reading')} alt="" aria-hidden="true" />
        Money notes
      </h2>

      {isCurrentMonth && (
        <div className="per-day">
          <p className="per-day-title">Safe to spend each day for the rest of the month</p>
          <div className="per-day-grid">
            {BUCKETS.map((b) => {
              const left = Math.max(Number(limits[b.id]) - spent[b.id], 0)
              return (
                <div key={b.id} className="per-day-item" style={{ '--c': b.color }}>
                  <span className="per-day-amt">{fmt(left / daysLeft)}</span>
                  <span className="per-day-name">{b.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="facts">
        <p>
          You spend about <strong>{fmt(dailyAvg)}</strong> a day on average.
        </p>
        <p>
          Biggest expense: <strong>{fmt(biggest.amount)}</strong> on {biggest.note || bigBucket.hint} (
          {bigBucket.label}).
        </p>
      </div>

    </section>
  )
}

function Sheet({ title, peek, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        {peek && <img className="sheet-peek" src={pic(peek)} alt="" aria-hidden="true" />}
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

function ExpenseSheet({ initial, defaultBucket, onSave, onDelete, onClose }) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [bucket, setBucket] = useState(initial ? initial.bucket : defaultBucket)
  const [note, setNote] = useState(initial ? initial.note : '')
  const [date, setDate] = useState(initial ? initial.date : todayISO())
  const amountRef = useRef(null)

  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  const value = Number(amount)
  const valid = value > 0

  function submit() {
    if (!valid) return
    onSave({
      id: initial?.id || crypto.randomUUID(),
      createdAt: initial?.createdAt || Date.now(),
      amount: value,
      bucket,
      note: note.trim(),
      date,
    })
  }

  return (
    <Sheet title={initial ? 'Edit expense' : 'Add expense'} peek={initial ? 'curious' : 'wink'} onClose={onClose}>
      <label className="amount-field">
        <span className="rupee">₹</span>
        <input
          ref={amountRef}
          inputMode="decimal"
          type="number"
          min="0"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-label="Amount in rupees"
        />
      </label>

      <div className="chips" role="radiogroup" aria-label="Who is this for">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            role="radio"
            aria-checked={bucket === b.id}
            className={`chip ${bucket === b.id ? 'on' : ''}`}
            style={{ '--c': b.color, '--soft': b.soft }}
            onClick={() => setBucket(b.id)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <input
        className="text-field"
        placeholder="What was it for? (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <input className="text-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <button className="primary" disabled={!valid} onClick={submit}>
        {initial ? 'Save changes' : 'Add expense'}
      </button>
      {initial && (
        <button className="danger" onClick={() => onDelete(initial.id)}>
          Delete expense
        </button>
      )}
    </Sheet>
  )
}

function LimitsSheet({ limits, onSave, onClose }) {
  const [vals, setVals] = useState({ ...limits })
  return (
    <Sheet title="Monthly limits" peek="signpost" onClose={onClose}>
      {BUCKETS.map((b) => (
        <label key={b.id} className="limit-row" style={{ '--c': b.color }}>
          <span className="limit-name">
            {b.label}
            <small>{b.hint}</small>
          </span>
          <span className="limit-input">
            ₹
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={vals[b.id]}
              onChange={(e) => setVals({ ...vals, [b.id]: e.target.value })}
            />
          </span>
        </label>
      ))}
      <button
        className="primary"
        onClick={() =>
          onSave(Object.fromEntries(BUCKETS.map((b) => [b.id, Math.max(Number(vals[b.id]) || 0, 0)])))
        }
      >
        Save limits
      </button>
    </Sheet>
  )
}

function Burst() {
  const bits = ['paw', 'leaf', 'paw', 'leaf', 'paw', 'leaf', 'paw']
  return (
    <div className="burst" aria-hidden="true">
      {bits.map((b, i) => (
        <img
          key={i}
          src={pic(b)}
          style={{ '--a': `${-80 + i * 27}deg`, '--d': `${i * 40}ms` }}
          alt=""
        />
      ))}
    </div>
  )
}

function Calendar({ viewMonth, monthExpenses, selectedDay, onSelect }) {
  const y = viewMonth.getFullYear()
  const m = viewMonth.getMonth()
  const days = new Date(y, m + 1, 0).getDate()
  const lead = new Date(y, m, 1).getDay()
  const today = todayISO()

  const totals = {}
  monthExpenses.forEach((e) => (totals[e.date] = (totals[e.date] || 0) + Number(e.amount)))
  const max = Math.max(...Object.values(totals), 1)

  const cells = []
  for (let i = 0; i < lead; i++) cells.push(<span key={`b${i}`} />)
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`
    const total = totals[iso] || 0
    const future = iso > today
    cells.push(
      <button
        key={iso}
        className={`cal-day ${iso === today ? 'today' : ''} ${selectedDay === iso ? 'on' : ''} ${total ? 'has' : ''}`}
        style={{ '--i': total ? 0.25 + 0.75 * (total / max) : 0 }}
        disabled={future}
        onClick={() => onSelect(iso)}
        aria-label={`${prettyDay(iso)}, ${total ? fmt(total) + ' spent' : 'nothing spent'}`}
        aria-pressed={selectedDay === iso}
      >
        <span className="cal-num">{d}</span>
        <span className="cal-amt">{total ? fmtShort(total) : ''}</span>
      </button>
    )
  }

  return (
    <section className="calendar">
      <h2>Daily tracker</h2>
      <div className="cal-card">
        <div className="cal-grid cal-week">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="cal-grid">{cells}</div>
        <p className="cal-tip">Tap a day to see what was spent and add items to it.</p>
      </div>
    </section>
  )
}

function AddItemsSheet({ defaultBucket, defaultDate, onSave, onClose }) {
  const [date, setDate] = useState(defaultDate)
  const [items, setItems] = useState(() => [newItem(defaultBucket)])
  const [focusKey, setFocusKey] = useState(null)
  const refs = useRef({})

  useEffect(() => {
    const k = focusKey || items[0].key
    refs.current[k]?.focus()
  }, [focusKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  const addRow = () => {
    const it = newItem(items[items.length - 1].bucket)
    setItems((list) => [...list, it])
    setFocusKey(it.key)
  }
  const removeRow = (key) => setItems((list) => list.filter((it) => it.key !== key))

  const valid = items.filter((it) => Number(it.amount) > 0)
  const total = valid.reduce((a, it) => a + Number(it.amount), 0)

  function submit() {
    if (!valid.length) return
    const now = Date.now()
    onSave(
      valid.map((it, i) => ({
        id: crypto.randomUUID(),
        createdAt: now + i,
        amount: Number(it.amount),
        bucket: it.bucket,
        note: it.note.trim(),
        date,
      }))
    )
  }

  return (
    <Sheet title="Add expenses" peek="wink" onClose={onClose}>
      <label className="date-row">
        <span>Date</span>
        <input className="text-field" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </label>

      {items.map((it) => (
        <div className="item-card" key={it.key}>
          <div className="item-top">
            <label className="amount-field small">
              <span className="rupee">₹</span>
              <input
                ref={(el) => (refs.current[it.key] = el)}
                inputMode="decimal"
                type="number"
                min="0"
                placeholder="0"
                value={it.amount}
                onChange={(e) => update(it.key, { amount: e.target.value })}
                aria-label="Amount in rupees"
              />
            </label>
            {items.length > 1 && (
              <button className="icon-btn remove" onClick={() => removeRow(it.key)} aria-label="Remove this item">
                ×
              </button>
            )}
          </div>
          <div className="chips" role="radiogroup" aria-label="Who is this for">
            {BUCKETS.map((b) => (
              <button
                key={b.id}
                role="radio"
                aria-checked={it.bucket === b.id}
                className={`chip ${it.bucket === b.id ? 'on' : ''}`}
                style={{ '--c': b.color, '--soft': b.soft }}
                onClick={() => update(it.key, { bucket: b.id })}
              >
                {b.label}
              </button>
            ))}
          </div>
          <input
            className="text-field"
            placeholder="What was it for? (optional)"
            value={it.note}
            onChange={(e) => update(it.key, { note: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && addRow()}
          />
        </div>
      ))}

      <button className="add-row" onClick={addRow}>
        + Add another item
      </button>

      <button className="primary" disabled={!valid.length} onClick={submit}>
        {valid.length > 1 ? `Save ${valid.length} items (${fmt(total)})` : valid.length ? `Save ${fmt(total)}` : 'Add an amount to save'}
      </button>
    </Sheet>
  )
}

function PinScreen({ setup, error, onSubmit }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const clean = (v) => v.replace(/\D/g, '').slice(0, 8)
  const ok = pin.length >= 4 && (!setup || pin === confirm)

  async function go() {
    if (!ok || busy) return
    setBusy(true)
    await onSubmit(pin, setup)
    setBusy(false)
  }

  return (
    <div className="app pin-screen">
      <img className="pin-spiko" src={pic(setup ? 'love' : 'happy')} alt="" aria-hidden="true" />
      <h1 className="pin-title">{setup ? 'Create a family PIN' : 'Enter your family PIN'}</h1>
      <p className="pin-sub">
        {setup
          ? 'Pick 4 to 8 digits. You’ll use this PIN once on each phone, and then both phones share the same expenses.'
          : 'Enter the same PIN you use on your other phone.'}
      </p>
      <input
        className="pin-input"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        placeholder="PIN"
        value={pin}
        onChange={(e) => setPin(clean(e.target.value))}
        onKeyDown={(e) => e.key === 'Enter' && go()}
        autoFocus
      />
      {setup && (
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Same PIN again"
          value={confirm}
          onChange={(e) => setConfirm(clean(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && go()}
        />
      )}
      {error && <p className="pin-error">{error}</p>}
      <button className="primary" disabled={!ok || busy} onClick={go}>
        {busy ? 'One moment' : setup ? 'Create PIN' : 'Open'}
      </button>
    </div>
  )
}

const DANCE_MOVES = [
  { img: 'music', move: 'dance', fx: '♪' },
  { img: 'love', move: 'beat', fx: '♥' },
  { img: 'joyful', move: 'sway', fx: '✦' },
  { img: 'laugh', move: 'rock', fx: '♥' },
  { img: 'cheer', move: 'float', fx: '✦' },
  { img: 'wink', move: 'sway', fx: '♥' },
]

// The strolling Spiko's little routine: walk, stop and do something sweet, walk on
const STROLL = [
  { at: 0.5, walk: true, ms: 9000 },
  { at: 0.5, pose: 'cheer', act: 'dance', ms: 7000 },
  { at: 0, walk: true, ms: 9000 },
  { at: 0, pose: 'wink', act: 'rest', ms: 6000 },
  { at: 1, walk: true, ms: 16000 },
  { at: 1, pose: 'love', act: 'hug', ms: 7000 },
]

function Stroller() {
  const [i, setI] = useState(STROLL.length - 1)
  const [from, setFrom] = useState(1)
  const phase = STROLL[i]

  useEffect(() => {
    const t = setTimeout(() => {
      setFrom(phase.at)
      setI((n) => (n + 1) % STROLL.length)
    }, phase.ms)
    return () => clearTimeout(t)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  const facingRight = phase.walk && phase.at > from
  return (
    <div className="stroll" aria-hidden="true">
      <div
        className="walker"
        style={{
          left: `calc((100% - 56px) * ${phase.at})`,
          transitionDuration: phase.walk ? `${phase.ms}ms` : '0ms',
        }}
      >
        {phase.walk ? (
          <div className="walker-step" key={`w${i}`} style={{ transform: facingRight ? 'scaleX(-1)' : 'none' }}>
            <img src={pic('side')} alt="" />
            <span className="trail">♥</span>
          </div>
        ) : (
          <div className={`walker-pose act-${phase.act}`} key={`p${i}`}>
            <img src={pic(phase.pose)} alt="" />
            {phase.act === 'dance' && <span className="pose-fx">♪</span>}
            {phase.act === 'rest' && <span className="pose-fx">z</span>}
            {phase.act === 'hug' && <span className="pose-fx heart">♥</span>}
          </div>
        )}
      </div>
    </div>
  )
}

function UsCard() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * LOVE_NOTES.length))
  const [step, setStep] = useState(0)

  useEffect(() => {
    const a = setInterval(() => setIdx((i) => (i + 1) % LOVE_NOTES.length), 12000)
    const b = setInterval(() => setStep((s) => s + 1), 9000)
    return () => {
      clearInterval(a)
      clearInterval(b)
    }
  }, [])

  const move = DANCE_MOVES[step % DANCE_MOVES.length]

  return (
    <section className="us-card" aria-label="Us">
      <div className="float-hearts" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} style={{ '--x': `${10 + i * 15}%`, '--d': `${i * 2}s`, '--s': `${0.7 + (i % 3) * 0.25}` }}>
            ♥
          </span>
        ))}
      </div>
      <div className="us-row">
        <figure className="polaroid">
          <img src={usPhoto} alt="Bade Baba and Chota Baba together" />
          <figcaption>Bade Baba &amp; Chota Baba</figcaption>
        </figure>
        <button className="dancer" onClick={() => setStep((s) => s + 1)} aria-label="Make Spiko do a new move">
          <span className={`notes fx-${move.move}`} key={`fx${step}`} aria-hidden="true">
            <i>{move.fx}</i>
            <i>{move.fx}</i>
            <i>{move.fx}</i>
          </span>
          <img key={step} className={`move-${move.move}`} src={pic(move.img)} alt="" />
        </button>
      </div>
      <button className="love-note" key={idx} onClick={() => setIdx((i) => (i + 1) % LOVE_NOTES.length)}>
        <span className="love-heart" aria-hidden="true">♥</span>
        {LOVE_NOTES[idx]}
      </button>
      <Stroller />
    </section>
  )
}

function Reports({ day, viewMonth, expenses, limits }) {
  const [busy, setBusy] = useState(null)
  const [msg, setMsg] = useState('')
  const pics = {
    us: usPhoto,
    hero: pic('hero'),
    love: pic('love'),
    cozy: pic('cozy'),
    home: pic('hoodie'),
    eshan: pic('beanie'),
    niharika: pic('music'),
  }

  async function run(kind) {
    setBusy(kind)
    setMsg('')
    try {
      const args = { expenses, limits, buckets: BUCKETS, pics, note: randomNote() }
      const result =
        kind === 'daily'
          ? await makeDailyReport({ ...args, day })
          : await makeMonthlyReport({ ...args, month: viewMonth })
      if (result !== 'cancelled') setMsg(result === 'shared' ? 'Report ready to save.' : 'Report downloaded.')
    } catch {
      setMsg('Couldn’t make the report this time. Please try again.')
    }
    setBusy(null)
    setTimeout(() => setMsg(''), 3500)
  }

  const monthName = viewMonth.toLocaleDateString('en-IN', { month: 'long' })

  return (
    <section className="reports">
      <h2 className="with-pic">
        <img src={pic('joyful')} alt="" aria-hidden="true" />
        Reports
      </h2>
      <div className="report-grid">
        <button className="report-btn daily" disabled={!day || !!busy} onClick={() => run('daily')}>
          <img className="report-pic" src={pic('reading')} alt="" aria-hidden="true" />
          <span className="report-title">{busy === 'daily' ? 'Making it' : 'Daily report'}</span>
          <span className="report-sub">{day ? prettyDay(day) : 'Pick a day on the calendar'}</span>
        </button>
        <button className="report-btn monthly" disabled={!!busy} onClick={() => run('monthly')}>
          <img className="report-pic" src={pic('explorer')} alt="" aria-hidden="true" />
          <span className="report-title">{busy === 'monthly' ? 'Making it' : 'Monthly report'}</span>
          <span className="report-sub">{monthName}, with insights</span>
        </button>
      </div>
      <p className="report-tip">{msg || 'Saves a picture to your phone, handy as a backup.'}</p>
    </section>
  )
}
