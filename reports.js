// Draws daily and monthly reports onto a canvas and saves them as PNG images.

const C = {
  honey: '#F2C994',
  cream: '#F9E6C7',
  blush: '#E7C1C8',
  cocoa: '#6B4B3E',
  leaf: '#2E7D32',
  paper: '#FFF8EC',
  ink: '#3F2A21',
  muted: '#8A6F62',
  danger: '#B3413A',
  white: '#FFFFFF',
}
const W = 1080
const PAD = 60
const INNER = W - PAD * 2
const font = (weight, size) => `${weight} ${size}px 'Baloo 2', 'Nunito', system-ui, sans-serif`

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const fmt = (n) => rupee.format(Math.round(n || 0))
const pad2 = (n) => String(n).padStart(2, '0')

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const longDate = (iso) =>
  parseISO(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = (iso) => parseISO(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}
function fillRR(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color
  rr(ctx, x, y, w, h, r)
  ctx.fill()
}

function text(ctx, str, x, y, { weight = 700, size = 32, color = C.ink, align = 'left', baseline = 'alphabetic' } = {}) {
  ctx.font = font(weight, size)
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = baseline
  ctx.fillText(str, x, y)
}

function ellipsize(ctx, str, maxW) {
  if (ctx.measureText(str).width <= maxW) return str
  let s = str
  while (s.length && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

function wrapLines(ctx, str, maxW) {
  const words = str.split(' ')
  const lines = []
  let line = ''
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = test
  })
  if (line) lines.push(line)
  return lines
}

function drawContain(ctx, img, x, y, w, h) {
  if (!img) return
  const s = Math.min(w / img.width, h / img.height)
  const dw = img.width * s
  const dh = img.height * s
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh), dw, dh)
}

function drawCirclePhoto(ctx, img, cx, cy, r) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r + 10, 0, Math.PI * 2)
  ctx.fillStyle = C.white
  ctx.fill()
  if (img) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.clip()
    const s = Math.max((r * 2) / img.width, (r * 2) / img.height)
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s)
  }
  ctx.restore()
}

function heart(ctx, x, y, size, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 30, size / 30)
  ctx.beginPath()
  ctx.moveTo(0, 9)
  ctx.bezierCurveTo(-15, -2, -9, -16, 0, -8)
  ctx.bezierCurveTo(9, -16, 15, -2, 0, 9)
  ctx.fillStyle = color
  ctx.fill()
  ctx.restore()
}

// ---------- shared blocks ----------

function headerBlock({ title, subtitle, imgs }) {
  return {
    h: 380,
    draw(ctx, y) {
      ctx.fillStyle = C.blush
      rr(ctx, 0, y - 60, W, 420, 60)
      ctx.fill()
      // soft stripes like Spiko's quills
      ctx.save()
      rr(ctx, 0, y - 60, W, 420, 60)
      ctx.clip()
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'
      ctx.lineWidth = 8
      for (let i = -400; i < W + 400; i += 26) {
        ctx.beginPath()
        ctx.moveTo(i, y - 60)
        ctx.lineTo(i + 200, y + 360)
        ctx.stroke()
      }
      ctx.restore()

      text(ctx, 'Baba’s Money Manager', W / 2, y + 62, { weight: 800, size: 46, color: C.cocoa, align: 'center' })
      drawCirclePhoto(ctx, imgs.us, PAD + 115, y + 215, 105)
      heart(ctx, PAD + 210, y + 128, 44, '#E05A6A')
      heart(ctx, PAD + 30, y + 310, 30, '#E05A6A')
      text(ctx, title, PAD + 265, y + 190, { weight: 800, size: 54, color: C.ink })
      ctx.font = font(700, 32)
      const lines = wrapLines(ctx, subtitle, 470)
      lines.forEach((l, i) => text(ctx, l, PAD + 265, y + 240 + i * 38, { weight: 700, size: 32, color: C.cocoa }))
      drawContain(ctx, imgs.hero, W - PAD - 170, y + 110, 170, 230)
    },
  }
}

function sectionTitle(label) {
  return {
    h: 90,
    draw(ctx, y) {
      text(ctx, label, PAD, y + 62, { weight: 800, size: 42, color: C.ink })
    },
  }
}

function spacer(h) {
  return { h, draw() {} }
}

function footerBlock({ note, imgs, measureCtx }) {
  measureCtx.font = font(700, 34)
  const lines = wrapLines(measureCtx, note, INNER - 340)
  const bubbleH = Math.max(lines.length * 46 + 70, 200)
  return {
    h: bubbleH + 150,
    draw(ctx, y) {
      fillRR(ctx, PAD, y + 20, INNER - 210, bubbleH, 40, C.white)
      // bubble tail
      ctx.beginPath()
      ctx.moveTo(PAD + INNER - 210, y + bubbleH - 40)
      ctx.lineTo(PAD + INNER - 170, y + bubbleH - 10)
      ctx.lineTo(PAD + INNER - 220, y + bubbleH - 10)
      ctx.fillStyle = C.white
      ctx.fill()
      heart(ctx, PAD + 50, y + 70, 34, '#E05A6A')
      lines.forEach((l, i) =>
        text(ctx, l, PAD + 90, y + 82 + i * 46, { weight: 700, size: 34, color: C.cocoa })
      )
      drawContain(ctx, imgs.love, W - PAD - 200, y + bubbleH - 190, 200, 220)
      const stamp = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      text(ctx, `Saved on ${stamp}`, W / 2, y + bubbleH + 110, {
        weight: 600,
        size: 26,
        color: C.muted,
        align: 'center',
      })
    },
  }
}

function itemRow(e, bucket, { showDate = false } = {}) {
  return {
    h: 92,
    draw(ctx, y) {
      fillRR(ctx, PAD, y + 6, INNER, 80, 26, C.paper)
      ctx.beginPath()
      ctx.arc(PAD + 40, y + 46, 12, 0, Math.PI * 2)
      ctx.fillStyle = bucket.color
      ctx.fill()
      ctx.font = font(800, 34)
      const amt = fmt(e.amount)
      const amtW = ctx.measureText(amt).width
      text(ctx, amt, PAD + INNER - 30, y + 58, { weight: 800, size: 34, align: 'right' })
      ctx.font = font(700, 32)
      const label = e.note || bucket.hint
      text(ctx, ellipsize(ctx, label, INNER - amtW - 330), PAD + 72, y + 57, { weight: 700, size: 32 })
      const tag = showDate ? `${bucket.label}` : bucket.label
      ctx.font = font(700, 26)
      const tagW = ctx.measureText(tag).width + 32
      const tagX = PAD + INNER - amtW - 60 - tagW
      fillRR(ctx, tagX, y + 26, tagW, 40, 20, bucket.soft)
      text(ctx, tag, tagX + tagW / 2, y + 55, { weight: 700, size: 26, color: bucket.color, align: 'center' })
    },
  }
}

function bucketBars({ buckets, spent, limits, imgs, title }) {
  return {
    h: 110 + buckets.length * 150,
    draw(ctx, y) {
      fillRR(ctx, PAD, y, INNER, 80 + buckets.length * 150, 40, C.paper)
      text(ctx, title, PAD + 36, y + 64, { weight: 800, size: 36, color: C.cocoa })
      buckets.forEach((b, i) => {
        const top = y + 90 + i * 150
        const limit = Number(limits[b.id] || 0)
        const used = spent[b.id] || 0
        const pct = limit ? used / limit : 0
        drawContain(ctx, imgs[b.id], PAD + 26, top - 6, 100, 120)
        text(ctx, b.label, PAD + 150, top + 34, { weight: 800, size: 36, color: b.color })
        text(ctx, `${fmt(used)} of ${fmt(limit)}`, PAD + INNER - 36, top + 34, {
          weight: 800,
          size: 34,
          align: 'right',
        })
        fillRR(ctx, PAD + 150, top + 52, INNER - 186, 24, 12, b.soft)
        fillRR(ctx, PAD + 150, top + 52, Math.max((INNER - 186) * Math.min(pct, 1), 24), 24, 12, b.color)
        const left = limit - used
        text(
          ctx,
          left >= 0
            ? `${fmt(left)} left · ${Math.round(pct * 100)}% used`
            : `${fmt(-left)} over the limit · ${Math.round(pct * 100)}% used`,
          PAD + 150,
          top + 112,
          { weight: 700, size: 28, color: left >= 0 ? C.muted : C.danger }
        )
      })
    },
  }
}

// ---------- render & save ----------

async function render(blocks, bg = C.cream) {
  const height = blocks.reduce((a, b) => a + b.h, 0) + 40
  // keep within mobile canvas limits
  const scale = Math.min(1, Math.sqrt(16000000 / (W * height)), 15000 / height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(W * scale)
  canvas.height = Math.floor(height * scale)
  const ctx = canvas.getContext('2d')
  ctx.scale(scale, scale)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, height)
  let y = 60
  blocks.forEach((b) => {
    b.draw(ctx, y)
    y += b.h
  })
  return canvas
}

async function saveCanvas(canvas, filename) {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not create the image')
  const file = new File([blob], filename, { type: 'image/png' })
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'shared'
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}

async function prepare(pics) {
  try {
    await Promise.all([
      document.fonts.load(font(800, 40)),
      document.fonts.load(font(700, 40)),
      document.fonts.load(font(600, 40)),
    ])
  } catch {
    /* fall back to system font */
  }
  const entries = await Promise.all(Object.entries(pics).map(async ([k, v]) => [k, await loadImage(v)]))
  return Object.fromEntries(entries)
}

// ---------- daily ----------

export async function makeDailyReport({ day, expenses, limits, buckets, pics, note }) {
  const imgs = await prepare(pics)
  const measure = document.createElement('canvas').getContext('2d')
  const items = expenses.filter((e) => e.date === day).sort((a, b) => a.createdAt - b.createdAt)
  const total = items.reduce((a, e) => a + Number(e.amount), 0)
  const byBucket = Object.fromEntries(buckets.map((b) => [b.id, 0]))
  items.forEach((e) => (byBucket[e.bucket] += Number(e.amount)))

  const monthKey = day.slice(0, 7)
  const monthSpent = Object.fromEntries(buckets.map((b) => [b.id, 0]))
  expenses
    .filter((e) => e.date.startsWith(monthKey) && e.date <= day)
    .forEach((e) => (monthSpent[e.bucket] += Number(e.amount)))

  const blocks = [
    headerBlock({ title: 'Daily report', subtitle: longDate(day), imgs }),
    spacer(30),
    {
      h: 290,
      draw(ctx, y) {
        fillRR(ctx, PAD, y, INNER, 260, 40, C.paper)
        text(ctx, 'Spent today', PAD + 40, y + 70, { weight: 700, size: 32, color: C.muted })
        text(ctx, fmt(total), PAD + 40, y + 150, { weight: 800, size: 84 })
        text(ctx, `${items.length} item${items.length === 1 ? '' : 's'}`, PAD + INNER - 40, y + 150, {
          weight: 700,
          size: 32,
          color: C.muted,
          align: 'right',
        })
        const colW = (INNER - 80) / buckets.length
        buckets.forEach((b, i) => {
          const x = PAD + 40 + i * colW
          text(ctx, b.label, x, y + 210, { weight: 800, size: 30, color: b.color })
          text(ctx, fmt(byBucket[b.id]), x, y + 245, { weight: 800, size: 30 })
        })
      },
    },
    sectionTitle('Everything bought today'),
  ]

  if (items.length === 0) {
    blocks.push({
      h: 300,
      draw(ctx, y) {
        fillRR(ctx, PAD, y, INNER, 270, 40, C.paper)
        drawContain(ctx, imgs.cozy, PAD + 30, y + 30, 230, 210)
        text(ctx, 'Nothing spent today.', PAD + 290, y + 120, { weight: 800, size: 40 })
        text(ctx, 'A calm, cosy day for the wallet.', PAD + 290, y + 170, { weight: 700, size: 32, color: C.muted })
      },
    })
  } else {
    items.forEach((e) => blocks.push(itemRow(e, buckets.find((b) => b.id === e.bucket))))
  }

  blocks.push(spacer(30))
  blocks.push(bucketBars({ buckets, spent: monthSpent, limits, imgs, title: 'This month so far' }))
  blocks.push(spacer(20))
  blocks.push(footerBlock({ note, imgs, measureCtx: measure }))

  const canvas = await render(blocks)
  return saveCanvas(canvas, `Baba-Money-Daily-${day}.png`)
}

// ---------- monthly ----------

export async function makeMonthlyReport({ month, expenses, limits, buckets, pics, note }) {
  const imgs = await prepare(pics)
  const measure = document.createElement('canvas').getContext('2d')
  const y0 = month.getFullYear()
  const m0 = month.getMonth()
  const key = `${y0}-${pad2(m0 + 1)}`
  const prev = new Date(y0, m0 - 1, 1)
  const prevKey = `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`
  const monthName = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const items = expenses
    .filter((e) => e.date.startsWith(key))
    .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
  const prevTotal = expenses.filter((e) => e.date.startsWith(prevKey)).reduce((a, e) => a + Number(e.amount), 0)

  const total = items.reduce((a, e) => a + Number(e.amount), 0)
  const totalLimit = buckets.reduce((a, b) => a + Number(limits[b.id] || 0), 0)
  const spent = Object.fromEntries(buckets.map((b) => [b.id, 0]))
  items.forEach((e) => (spent[e.bucket] += Number(e.amount)))

  const daysInMonth = new Date(y0, m0 + 1, 0).getDate()
  const now = new Date()
  const isCurrent = now.getFullYear() === y0 && now.getMonth() === m0
  const daysCounted = isCurrent ? now.getDate() : daysInMonth

  const perDay = Array.from({ length: daysInMonth }, () => 0)
  items.forEach((e) => (perDay[Number(e.date.slice(8, 10)) - 1] += Number(e.amount)))
  const maxDay = Math.max(...perDay, 1)
  const bigDayIdx = perDay.indexOf(Math.max(...perDay))
  const noSpend = perDay.slice(0, daysCounted).filter((v) => v === 0).length
  const biggest = items.reduce((a, e) => (!a || Number(e.amount) > Number(a.amount) ? e : a), null)

  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const byWeekday = Array(7).fill(0)
  items.forEach((e) => (byWeekday[parseISO(e.date).getDay()] += Number(e.amount)))
  const busiestWd = byWeekday.indexOf(Math.max(...byWeekday))

  const groups = {}
  items.forEach((e) => {
    const k = (e.note || 'Other').trim().toLowerCase()
    if (!groups[k]) groups[k] = { label: e.note || 'Other', total: 0, count: 0 }
    groups[k].total += Number(e.amount)
    groups[k].count += 1
  })
  const topGroups = Object.values(groups)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  let vsLast = 'No data for last month yet'
  if (prevTotal > 0) {
    const diff = ((total - prevTotal) / prevTotal) * 100
    vsLast = diff <= 0 ? `${Math.abs(Math.round(diff))}% less than last month` : `${Math.round(diff)}% more than last month`
  }

  const insights = [
    { label: 'Daily average', value: fmt(total / Math.max(daysCounted, 1)), sub: `over ${daysCounted} days` },
    {
      label: 'Biggest day',
      value: items.length ? fmt(perDay[bigDayIdx]) : fmt(0),
      sub: items.length ? shortDate(`${key}-${pad2(bigDayIdx + 1)}`) : 'No spending yet',
    },
    {
      label: 'Biggest expense',
      value: biggest ? fmt(biggest.amount) : fmt(0),
      sub: biggest ? biggest.note || buckets.find((b) => b.id === biggest.bucket).hint : 'No spending yet',
    },
    {
      label: 'Busiest weekday',
      value: items.length ? weekdays[busiestWd] : 'None yet',
      sub: items.length ? `${fmt(byWeekday[busiestWd])} in total` : '',
    },
    { label: 'No-spend days', value: String(noSpend), sub: noSpend ? 'Little wins for the team' : 'Busy month!' },
    { label: 'Compared with last month', value: prevTotal ? fmt(prevTotal) : 'First month', sub: vsLast },
  ]

  const blocks = [
    headerBlock({ title: 'Monthly report', subtitle: monthName, imgs }),
    spacer(30),
    {
      h: 300,
      draw(ctx, y) {
        fillRR(ctx, PAD, y, INNER, 270, 40, C.paper)
        text(ctx, 'Spent this month', PAD + 40, y + 70, { weight: 700, size: 32, color: C.muted })
        text(ctx, fmt(total), PAD + 40, y + 150, { weight: 800, size: 84 })
        text(ctx, `of ${fmt(totalLimit)}`, PAD + INNER - 40, y + 150, {
          weight: 700,
          size: 34,
          color: C.muted,
          align: 'right',
        })
        const pct = totalLimit ? Math.min(total / totalLimit, 1) : 0
        fillRR(ctx, PAD + 40, y + 180, INNER - 80, 26, 13, C.cream)
        fillRR(ctx, PAD + 40, y + 180, Math.max((INNER - 80) * pct, 26), 26, 13, total > totalLimit ? C.danger : C.leaf)
        text(
          ctx,
          `${items.length} entries · ${total <= totalLimit ? `${fmt(totalLimit - total)} still free` : `${fmt(total - totalLimit)} over`}`,
          PAD + 40,
          y + 248,
          { weight: 700, size: 30, color: C.muted }
        )
      },
    },
    spacer(10),
    bucketBars({ buckets, spent, limits, imgs, title: 'Each budget' }),
    sectionTitle('Insights'),
    {
      h: 3 * 190 + 10,
      draw(ctx, y) {
        const cw = (INNER - 24) / 2
        insights.forEach((it, i) => {
          const x = PAD + (i % 2) * (cw + 24)
          const top = y + Math.floor(i / 2) * 190
          fillRR(ctx, x, top, cw, 170, 32, i % 3 === 0 ? C.honey : C.paper)
          text(ctx, it.label, x + 28, top + 50, { weight: 700, size: 28, color: C.cocoa })
          ctx.font = font(800, 46)
          text(ctx, ellipsize(ctx, it.value, cw - 56), x + 28, top + 108, { weight: 800, size: 46 })
          ctx.font = font(700, 26)
          text(ctx, ellipsize(ctx, it.sub, cw - 56), x + 28, top + 146, { weight: 700, size: 26, color: C.muted })
        })
      },
    },
    sectionTitle('Day by day'),
    {
      h: 330,
      draw(ctx, y) {
        fillRR(ctx, PAD, y, INNER, 300, 36, C.paper)
        const chartW = INNER - 60
        const bw = chartW / daysInMonth
        perDay.forEach((v, i) => {
          const h = v ? Math.max((v / maxDay) * 200, 8) : 4
          const x = PAD + 30 + i * bw
          fillRR(ctx, x + bw * 0.15, y + 230 - h, bw * 0.7, h, Math.min(8, bw * 0.3), v === maxDay && v ? '#C27A8C' : C.cocoa)
          if ((i + 1) % 5 === 0 || i === 0)
            text(ctx, String(i + 1), x + bw / 2, y + 272, { weight: 700, size: 22, color: C.muted, align: 'center' })
        })
      },
    },
  ]

  if (topGroups.length) {
    blocks.push(sectionTitle('Where the money went'))
    topGroups.forEach((g, i) => {
      blocks.push({
        h: 84,
        draw(ctx, y) {
          fillRR(ctx, PAD, y + 4, INNER, 74, 24, C.paper)
          const pct = total ? g.total / total : 0
          fillRR(ctx, PAD, y + 4, Math.max(INNER * pct, 48), 74, 24, 'rgba(231,193,200,0.7)')
          text(ctx, `${i + 1}`, PAD + 34, y + 54, { weight: 800, size: 30, color: C.cocoa, align: 'center' })
          ctx.font = font(700, 30)
          text(ctx, ellipsize(ctx, `${g.label} (${g.count}×)`, INNER - 360), PAD + 70, y + 54, { weight: 700, size: 30 })
          text(ctx, `${fmt(g.total)} · ${Math.round(pct * 100)}%`, PAD + INNER - 30, y + 54, {
            weight: 800,
            size: 30,
            align: 'right',
          })
        },
      })
    })
  }

  blocks.push(sectionTitle('Every expense'))
  if (!items.length) {
    blocks.push({
      h: 120,
      draw(ctx, y) {
        text(ctx, 'No expenses recorded this month.', PAD, y + 60, { weight: 700, size: 32, color: C.muted })
      },
    })
  }
  let lastDay = null
  items.forEach((e) => {
    if (e.date !== lastDay) {
      lastDay = e.date
      const dayTotal = perDay[Number(e.date.slice(8, 10)) - 1]
      const label = shortDate(e.date)
      blocks.push({
        h: 64,
        draw(ctx, y) {
          text(ctx, label, PAD + 10, y + 48, { weight: 800, size: 30, color: C.muted })
          text(ctx, fmt(dayTotal), PAD + INNER - 10, y + 48, { weight: 800, size: 30, color: C.muted, align: 'right' })
        },
      })
    }
    blocks.push(itemRow(e, buckets.find((b) => b.id === e.bucket)))
  })

  blocks.push(spacer(30))
  blocks.push(footerBlock({ note, imgs, measureCtx: measure }))

  const canvas = await render(blocks)
  return saveCanvas(canvas, `Baba-Money-Monthly-${key}.png`)
}
