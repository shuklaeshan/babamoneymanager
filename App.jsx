import { useEffect, useMemo, useRef, useState } from 'react'

const IMAGES = import.meta.glob('./*.png', { eager: true, import: 'default' })
const pic = (name) => IMAGES[`./${name}.png`]

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

export default function App() {
  const [data, setData] = useState(loadData)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [sheet, setSheet] = useState(null) // null | {mode:'add'} | {mode:'edit', expense} | {mode:'limits'}
  const [filter, setFilter] = useState('all')
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

  function saveExpense(exp) {
    setData((d) => {
      const exists = d.expenses.some((e) => e.id === exp.id)
      return {
        ...d,
        expenses: exists ? d.expenses.map((e) => (e.id === exp.id ? exp : e)) : [...d.expenses, exp],
      }
    })
    setSheet(null)
    const bucket = BUCKETS.find((b) => b.id === exp.bucket)
    setCelebrate(`Saved ${fmt(exp.amount)} to ${bucket.label}.`)
    clearTimeout(celebrateTimer.current)
    celebrateTimer.current = setTimeout(() => setCelebrate(null), 2600)
  }

  function deleteExpense(id) {
    setData((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }))
    setSheet(null)
  }

  function saveLimits(limits) {
    setData((d) => ({ ...d, limits }))
    setSheet(null)
  }

  function shiftMonth(delta) {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }

  const listed = filter === 'all' ? monthExpenses : monthExpenses.filter((e) => e.bucket === filter)
  const grouped = listed.reduce((acc, e) => {
    ;(acc[e.date] = acc[e.date] || []).push(e)
    return acc
  }, {})

  return (
    <div className="app">
      <h1 className="brand">
        <img src={pic('leaf')} alt="" aria-hidden="true" className="brand-leaf left" />
        Baba’s Money Manager
        <img src={pic('leaf')} alt="" aria-hidden="true" className="brand-leaf right" />
      </h1>
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

      <section className="list-section">
        <h2>
          {filter === 'all' ? 'Expenses' : `${BUCKETS.find((b) => b.id === filter).label} expenses`}
        </h2>
        {listed.length === 0 ? (
          <div className="empty">
            <img src={pic('cozy')} alt="" />
            <p>Nothing here yet. Tap “Add expense” to log your first one.</p>
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

      {sheet && (sheet.mode === 'add' || sheet.mode === 'edit') && (
        <ExpenseSheet
          initial={sheet.expense}
          defaultBucket={filter === 'all' ? 'home' : filter}
          onSave={saveExpense}
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

  // last 7 days
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = toISO(d)
    days.push({
      iso,
      label: d.toLocaleDateString('en-IN', { weekday: 'narrow' }),
      total: monthExpenses.filter((e) => e.date === iso).reduce((a, e) => a + Number(e.amount), 0),
    })
  }
  const maxDay = Math.max(...days.map((d) => d.total), 1)

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

      {isCurrentMonth && (
        <div className="week" aria-label="Spending over the last seven days">
          {days.map((d) => (
            <div className="week-col" key={d.iso}>
              <div className="week-bar-wrap">
                <div className="week-bar" style={{ height: `${(d.total / maxDay) * 100}%` }} />
              </div>
              <span className="week-label">{d.label}</span>
            </div>
          ))}
        </div>
      )}
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
        {children}
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
