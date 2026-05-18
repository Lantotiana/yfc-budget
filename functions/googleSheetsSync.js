const admin = require('firebase-admin')
const crypto = require('crypto')
const { HttpsError } = require('firebase-functions/v2/https')

const SHEET_ID = {
  OVERVIEW: 0,
}

const TABS = [
  'OVERVIEW',
  'MEMBRES',
  'BUDGET',
  'BUDGET_MENSUEL',
  'BUDGET_ANNUEL',
  'PRESENCES',
  'PRESENCES_DETAIL',
  'LOG_SYNC',
]

const HEADERS = {
  MEMBRES: [
    'ID Firebase', 'Nom', 'Prenoms', 'Nom prefere / Alias', 'Email', 'Telephone',
    'Role', 'Statut', 'Est Staff', 'Groupe / Departement', 'Date inscription',
    'Date derniere modification', 'Approuve', 'Actif',
  ],
  BUDGET: [
    'ID Firebase', 'Date', 'Mois', 'Annee', 'Type', 'Categorie', 'Description',
    'Montant', 'Devise', 'Cree par', 'Date creation', 'Date modification',
  ],
  BUDGET_MENSUEL: ['Mois', 'Annee', 'Total Entrees', 'Total Sorties', 'Solde', 'Nombre operations'],
  BUDGET_ANNUEL: ['Annee', 'Total Entrees', 'Total Sorties', 'Solde', 'Nombre operations'],
  PRESENCES: [
    'ID evenement', 'Date', 'Nom de evenement', 'Nombre presents', 'Nombre absents',
    'Total concernes', 'Taux de presence', 'Cree par', 'Date creation',
  ],
  PRESENCES_DETAIL: [
    'ID evenement', 'Date', 'Nom de evenement', 'ID membre', 'Nom prefere / Prenom',
    'Nom complet', 'Statut de presence', 'Motif si absent', 'Groupe / role',
  ],
  LOG_SYNC: ['Date / heure', 'Type action', 'Collection Firestore', 'ID document', 'Resultat', 'Message', 'Erreur eventuelle'],
  VOTES: ['Date / heure', 'Nom', '1ere entree', '2eme entree', 'User agent'],
}

const COLORS = {
  blue: { red: 0.047, green: 0.753, blue: 0.875 },
  yellow: { red: 1, green: 0.741, blue: 0.349 },
  green: { red: 0.851, green: 0.918, blue: 0.827 },
  red: { red: 0.957, green: 0.8, blue: 0.8 },
  softYellow: { red: 1, green: 0.949, blue: 0.8 },
  grey: { red: 0.953, green: 0.953, blue: 0.953 },
  dark: { red: 0.122, green: 0.161, blue: 0.216 },
  white: { red: 1, green: 1, blue: 1 },
}
const AMOUNT_FORMAT = '#,##0" Ar"'

let tokenCache = null

function nowIso() {
  return new Date().toISOString()
}

function envValue(name, secrets = {}) {
  return secrets[name]?.value?.() || process.env[name] || ''
}

function normalizePrivateKey(key) {
  return String(key || '').replace(/\\n/g, '\n')
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getAccessToken(secrets) {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token

  const email = envValue('GOOGLE_SERVICE_ACCOUNT_EMAIL', secrets)
  const privateKey = normalizePrivateKey(envValue('GOOGLE_PRIVATE_KEY', secrets))
  if (!email || !privateKey) {
    throw new HttpsError('failed-precondition', 'Google service account secrets are not configured')
  }

  const iat = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: iat + 3600,
    iat,
  }))
  const unsigned = `${header}.${claim}`
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${data.error_description || data.error || 'unknown error'}`)

  tokenCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 }
  return tokenCache.token
}

async function sheetsFetch(secrets, path, options = {}) {
  const sheetId = envValue('GOOGLE_SHEET_ID', secrets)
  if (!sheetId) throw new HttpsError('failed-precondition', 'GOOGLE_SHEET_ID is not configured')

  const token = await getAccessToken(secrets)
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(`Sheets API ${res.status}: ${data.error?.message || text}`)
  return data
}

async function getSpreadsheet(secrets) {
  return sheetsFetch(secrets, '?fields=sheets(properties(sheetId,title),protectedRanges(protectedRangeId,range(sheetId)),conditionalFormats)')
}

async function batchUpdate(secrets, requests) {
  if (!requests.length) return {}
  return sheetsFetch(secrets, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests }),
  })
}

async function valuesBatchUpdate(secrets, data) {
  if (!data.length) return {}
  return sheetsFetch(secrets, '/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
  })
}

async function valuesClear(secrets, tab) {
  return sheetsFetch(secrets, `/values/${encodeURIComponent(`${tab}!A:Z`)}:clear`, { method: 'POST', body: '{}' })
}

async function valuesAppend(secrets, tab, values) {
  return sheetsFetch(secrets, `/values/${encodeURIComponent(`${tab}!A:Z`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values }),
  })
}

async function valuesGet(secrets, range) {
  return sheetsFetch(secrets, `/values/${encodeURIComponent(range)}`)
}

function sheetMap(spreadsheet) {
  const map = new Map()
  for (const s of spreadsheet.sheets || []) map.set(s.properties.title, s)
  return map
}

function headerStyle(backgroundColor, foregroundColor = COLORS.white) {
  return {
    userEnteredFormat: {
      backgroundColor,
      horizontalAlignment: 'CENTER',
      textFormat: { bold: true, foregroundColor },
      borders: {
        bottom: { style: 'SOLID', width: 1, color: COLORS.dark },
      },
    },
  }
}

function range(sheetId, startRowIndex, endRowIndex, startColumnIndex = 0, endColumnIndex = 26) {
  return { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex }
}

function wholeSheetRange(sheetId) {
  return { sheetId, startRowIndex: 0, startColumnIndex: 0 }
}

function safeString(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return value.nom || value.email || value.uid || JSON.stringify(value)
  return String(value)
}

function toAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const normalized = safeString(value)
    .replace(/\s/g, '')
    .replace(/[^\d,.-]/g, '')
    .replace(',', '.')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : 0
}

function toDateString(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [y, m, d] = value.slice(0, 10).split('-')
      return `${d}/${m}/${y}`
    }
    return value
  }
  if (value.toDate) return toDateString(value.toDate().toISOString())
  if (value.seconds) return toDateString(new Date(value.seconds * 1000).toISOString())
  return ''
}

function toDateTimeString(value) {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : null
  if (!date || Number.isNaN(date.getTime())) return safeString(value)
  return date.toLocaleString('fr-FR', {
    timeZone: 'Indian/Mauritius',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function monthLabel(yyyyMm) {
  if (!yyyyMm) return ''
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('fr-FR', { month: 'long' })
}

function titleCase(value) {
  const text = safeString(value)
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

function monthKey(date) {
  return typeof date === 'string' && date.length >= 7 ? date.slice(0, 7) : ''
}

function yearKey(date) {
  return typeof date === 'string' && date.length >= 4 ? date.slice(0, 4) : ''
}

function typeLabel(type) {
  if (type === 'entree') return 'Entree'
  if (type === 'depense') return 'Sortie'
  return safeString(type)
}

function displayMemberName(m) {
  return safeString(m.nomPrefere || m.prenoms || `${m.nom || ''} ${m.prenoms || ''}`.trim() || m.nom)
}

function fullMemberName(m) {
  return `${m.nom || ''} ${m.prenoms || ''}`.trim()
}

async function listCollection(db, collectionName, orderField = null) {
  let ref = db.collection(collectionName)
  if (orderField) ref = ref.orderBy(orderField)
  const snap = await ref.get()
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

async function loadData() {
  const db = admin.firestore()
  const [membres, transactions, events, presences, users] = await Promise.all([
    listCollection(db, 'membres', 'nom'),
    listCollection(db, 'transactions', 'date'),
    listCollection(db, 'evenements', 'date'),
    listCollection(db, 'presences'),
    listCollection(db, 'users'),
  ])
  return { membres, transactions, events, presences, users }
}

function buildRows({ membres, transactions, events, presences, users }) {
  const usersByEmail = new Map(users.filter(u => u.email).map(u => [u.email.trim().toLowerCase(), u]))
  const presencesByEvent = new Map()

  for (const p of presences) {
    const eventId = p.eventId || p.evenementId
    if (!eventId) continue
    if (!presencesByEvent.has(eventId)) presencesByEvent.set(eventId, [])
    presencesByEvent.get(eventId).push(p)
  }

  const memberRows = membres.map(m => {
    const user = m.email ? usersByEmail.get(m.email.trim().toLowerCase()) : null
    const approved = user?.approuve === true
    const staff = m.staff === true || approved
    const active = m.actif !== false && m.active !== false
    const status = !approved && m.email ? 'Non approuve' : active ? 'Actif' : 'Inactif'
    return [
      m.id, safeString(m.nom), safeString(m.prenoms), safeString(m.nomPrefere), safeString(m.email),
      safeString(m.telephone || m.tel), safeString(m.staffRole), status, staff ? 'Oui' : 'Non',
      safeString(m.tags), toDateString(m.dateAjout || m.dateInscription), toDateTimeString(m.updatedAt),
      approved ? 'Oui' : 'Non', active ? 'Oui' : 'Non',
    ]
  })

  const budgetRows = transactions
    .slice()
    .sort((a, b) => safeString(b.date).localeCompare(safeString(a.date)))
    .map(t => [
      t.id, toDateString(t.date), titleCase(monthLabel(monthKey(t.date))), yearKey(t.date),
      typeLabel(t.type), safeString(t.motif || t.categorie || t.category),
      safeString(t.note || t.description), toAmount(t.montant), safeString(t.devise || 'Ar'),
      safeString(t.createdBy), toDateTimeString(t.createdAt), toDateTimeString(t.updatedAt),
    ])

  const monthly = new Map()
  const yearly = new Map()
  for (const t of transactions) {
    const mKey = monthKey(t.date)
    const yKey = yearKey(t.date)
    const amount = toAmount(t.montant)
    const apply = bucket => {
      if (!bucket) return
      bucket.count += 1
      if (t.type === 'entree') bucket.entrees += amount
      else bucket.sorties += amount
    }
    if (mKey) {
      if (!monthly.has(mKey)) monthly.set(mKey, { month: mKey, year: yKey, entrees: 0, sorties: 0, count: 0 })
      apply(monthly.get(mKey))
    }
    if (yKey) {
      if (!yearly.has(yKey)) yearly.set(yKey, { year: yKey, entrees: 0, sorties: 0, count: 0 })
      apply(yearly.get(yKey))
    }
  }

  const monthlyRows = [...monthly.values()]
    .sort((a, b) => b.month.localeCompare(a.month))
    .map(r => [titleCase(monthLabel(r.month)), r.year, r.entrees, r.sorties, r.entrees - r.sorties, r.count])
  const yearlyRows = [...yearly.values()]
    .sort((a, b) => b.year.localeCompare(a.year))
    .map(r => [r.year, r.entrees, r.sorties, r.entrees - r.sorties, r.count])

  const presenceRows = events
    .slice()
    .sort((a, b) => safeString(b.date).localeCompare(safeString(a.date)))
    .map(e => {
      const records = presencesByEvent.get(e.id) || []
      const eventTags = Array.isArray(e.tags) ? e.tags : []
      const relevantMembers = eventTags.length
        ? membres.filter(m => Array.isArray(m.tags) && m.tags.some(t => eventTags.includes(t)))
        : membres
      const present = relevantMembers.filter(m => records.some(p => p.membreId === m.id && p.present === true)).length
      const total = relevantMembers.length
      const absent = Math.max(total - present, 0)
      return [
        e.id, toDateString(e.date), safeString(e.titre || e.nom), present, absent, total,
        total ? `${Math.round((present / total) * 100)}%` : '0%', safeString(e.createdBy), toDateTimeString(e.createdAt),
      ]
    })

  const detailRows = []
  for (const e of events) {
    const records = presencesByEvent.get(e.id) || []
    const eventTags = Array.isArray(e.tags) ? e.tags : []
    const relevantMembers = eventTags.length
      ? membres.filter(m => Array.isArray(m.tags) && m.tags.some(t => eventTags.includes(t)))
      : membres
    for (const m of relevantMembers) {
      const record = records.find(p => p.membreId === m.id)
      detailRows.push([
        e.id, toDateString(e.date), safeString(e.titre || e.nom), m.id, displayMemberName(m),
        fullMemberName(m), record?.present === true ? 'Present' : 'Absent', safeString(record?.motif || record?.reason),
        safeString(m.tags || m.staffRole),
      ])
    }
  }

  const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((sum, t) => sum + toAmount(t.montant), 0)
  const totalSorties = transactions.filter(t => t.type !== 'entree').reduce((sum, t) => sum + toAmount(t.montant), 0)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthTransactions = transactions.filter(t => monthKey(t.date) === currentMonth)
  const monthEntrees = monthTransactions.filter(t => t.type === 'entree').reduce((sum, t) => sum + toAmount(t.montant), 0)
  const monthSorties = monthTransactions.filter(t => t.type !== 'entree').reduce((sum, t) => sum + toAmount(t.montant), 0)
  const monthOptions = ['Tous', ...[...new Set(transactions.map(t => titleCase(monthLabel(monthKey(t.date)))).filter(Boolean))]]
  const yearOptions = ['Tous', ...[...new Set(transactions.map(t => yearKey(t.date)).filter(Boolean))].sort((a, b) => b.localeCompare(a))]
  const currentYear = new Date().getFullYear().toString()
  const defaultYear = yearOptions.includes(currentYear) ? currentYear : 'Tous'
  const selectedMonthCell = '$B$4'
  const selectedYearCell = '$B$5'
  const filteredEntreesFormula = `=IFERROR(IF(AND(${selectedMonthCell}="Tous";${selectedYearCell}="Tous");SUMIF(BUDGET!E2:E;"Entree";BUDGET!H2:H);IF(${selectedMonthCell}="Tous";SUMIFS(BUDGET!H2:H;BUDGET!E2:E;"Entree";BUDGET!D2:D;${selectedYearCell});IF(${selectedYearCell}="Tous";SUMIFS(BUDGET!H2:H;BUDGET!E2:E;"Entree";BUDGET!C2:C;${selectedMonthCell});SUMIFS(BUDGET!H2:H;BUDGET!E2:E;"Entree";BUDGET!C2:C;${selectedMonthCell};BUDGET!D2:D;${selectedYearCell}))));0)`
  const filteredSortiesFormula = `=IFERROR(IF(AND(${selectedMonthCell}="Tous";${selectedYearCell}="Tous");SUMIF(BUDGET!E2:E;"Sortie";BUDGET!H2:H);IF(${selectedMonthCell}="Tous";SUMIFS(BUDGET!H2:H;BUDGET!E2:E;"Sortie";BUDGET!D2:D;${selectedYearCell});IF(${selectedYearCell}="Tous";SUMIFS(BUDGET!H2:H;BUDGET!E2:E;"Sortie";BUDGET!C2:C;${selectedMonthCell});SUMIFS(BUDGET!H2:H;BUDGET!E2:E;"Sortie";BUDGET!C2:C;${selectedMonthCell};BUDGET!D2:D;${selectedYearCell}))));0)`

  const overviewRows = [
    ['YFC - Tableau de bord', ''],
    ['Ce fichier est une copie automatique des donnees Firebase. Ne pas modifier manuellement.', ''],
    ['Derniere synchronisation', toDateTimeString(nowIso())],
    ['Mois', 'Tous'],
    ['Annee', defaultYear],
    ['', ''],
    ['BUDGET SELON LE FILTRE', ''],
    ['Total entree', filteredEntreesFormula],
    ['Total sortie', filteredSortiesFormula],
    ['Solde filtre', '=B8-B9'],
    ['', ''],
    ['BUDGET GLOBAL', ''],
    ['Total des entrees', totalEntrees],
    ['Total des sorties', totalSorties],
    ['Solde global', totalEntrees - totalSorties],
    ['Entrees du mois actuel', monthEntrees],
    ['Sorties du mois actuel', monthSorties],
    ['Solde du mois actuel', monthEntrees - monthSorties],
    ['', ''],
    ['MEMBRES ET PRESENCES', ''],
    ['Nombre total de membres', membres.length],
    ['Nombre de staff', memberRows.filter(r => r[8] === 'Oui').length],
    ['Nombre de membres actifs', memberRows.filter(r => r[13] === 'Oui').length],
    ['Nombre evenements de presence', events.length],
  ]

  return {
    OVERVIEW: overviewRows,
    MEMBRES: [HEADERS.MEMBRES, ...memberRows],
    BUDGET: [HEADERS.BUDGET, ...budgetRows],
    BUDGET_MENSUEL: [HEADERS.BUDGET_MENSUEL, ...monthlyRows],
    BUDGET_ANNUEL: [HEADERS.BUDGET_ANNUEL, ...yearlyRows],
    PRESENCES: [HEADERS.PRESENCES, ...presenceRows],
    PRESENCES_DETAIL: [HEADERS.PRESENCES_DETAIL, ...detailRows],
    options: { months: monthOptions, years: yearOptions },
    counts: {
      membres: membres.length,
      transactions: transactions.length,
      events: events.length,
    },
  }
}

async function appendSyncLog(secrets, { action, collection = '', documentId = '', result = 'Succes', message = '', error = '' }) {
  try {
    await valuesAppend(secrets, 'LOG_SYNC', [[toDateTimeString(nowIso()), action, collection, documentId, result, message, error]])
  } catch (e) {
    console.error('Unable to write LOG_SYNC', e)
  }
}

async function ensureTabs(secrets) {
  let spreadsheet = await getSpreadsheet(secrets)
  let map = sheetMap(spreadsheet)
  const requests = TABS
    .filter(title => !map.has(title))
    .map(title => ({ addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: 26 } } } }))
  if (requests.length) {
    await batchUpdate(secrets, requests)
    spreadsheet = await getSpreadsheet(secrets)
    map = sheetMap(spreadsheet)
  }
  for (const [title, sheet] of map.entries()) SHEET_ID[title] = sheet.properties.sheetId
  return map
}

async function ensureVoteTab(secrets) {
  let spreadsheet = await getSpreadsheet(secrets)
  let map = sheetMap(spreadsheet)

  if (!map.has('VOTES')) {
    await batchUpdate(secrets, [
      { addSheet: { properties: { title: 'VOTES', gridProperties: { rowCount: 1000, columnCount: 12 } } } },
    ])
    spreadsheet = await getSpreadsheet(secrets)
    map = sheetMap(spreadsheet)
  }

  const sheet = map.get('VOTES')
  if (!sheet) throw new HttpsError('internal', 'Unable to prepare VOTES sheet')
  SHEET_ID.VOTES = sheet.properties.sheetId

  await valuesBatchUpdate(secrets, [
    { range: 'VOTES!A1:E1', values: [HEADERS.VOTES] },
  ])

  await batchUpdate(secrets, [
    { updateSheetProperties: { properties: { sheetId: sheet.properties.sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
    { repeatCell: { range: range(sheet.properties.sheetId, 0, 1, 0, 5), cell: headerStyle(COLORS.green, COLORS.dark), fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat,borders)' } },
    { autoResizeDimensions: { dimensions: { sheetId: sheet.properties.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 } } },
  ])
}

async function appendVote(secrets, row) {
  await ensureVoteTab(secrets)
  await valuesAppend(secrets, 'VOTES', [row])
}

async function getVoteRows(secrets) {
  try {
    const data = await valuesGet(secrets, 'VOTES!A2:E')
    return data.values || []
  } catch (e) {
    console.error('Unable to read VOTES sheet', e)
    return []
  }
}

function formatRequests(map, secrets) {
  const requests = []
  const serviceAccountEmail = envValue('GOOGLE_SERVICE_ACCOUNT_EMAIL', secrets)
  for (const tab of TABS) {
    const sheet = map.get(tab)
    if (!sheet) continue
    const sheetId = sheet.properties.sheetId
    const headerColor = tab === 'OVERVIEW' || tab.includes('BUDGET') ? COLORS.yellow : COLORS.blue
    const foreground = tab.includes('BUDGET') ? COLORS.dark : COLORS.white
    for (let i = (sheet.conditionalFormats || []).length - 1; i >= 0; i -= 1) {
      requests.push({ deleteConditionalFormatRule: { sheetId, index: i } })
    }
    for (const protectedRange of sheet.protectedRanges || []) {
      requests.push({ deleteProtectedRange: { protectedRangeId: protectedRange.protectedRangeId } })
    }
    requests.push(
      { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: tab === 'OVERVIEW' ? 0 : 1 } }, fields: 'gridProperties.frozenRowCount' } },
      { repeatCell: { range: range(sheetId, 0, 1), cell: headerStyle(headerColor, foreground), fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat,borders)' } },
      { autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 14 } } },
    )
    if (tab !== 'OVERVIEW') requests.push({ setBasicFilter: { filter: { range: wholeSheetRange(sheetId) } } })

    if (tab === 'OVERVIEW') {
      requests.push(
        {
          repeatCell: {
            range: range(sheetId, 0, 1, 0, 2),
            cell: {
              userEnteredFormat: {
                backgroundColor: COLORS.blue,
                horizontalAlignment: 'CENTER',
                textFormat: { bold: true, fontSize: 18, foregroundColor: COLORS.white },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)',
          },
        },
        {
          repeatCell: {
            range: range(sheetId, 1, 23, 0, 2),
            cell: { userEnteredFormat: { backgroundColor: COLORS.grey, borders: { bottom: { style: 'SOLID', color: COLORS.white } } } },
            fields: 'userEnteredFormat(backgroundColor,borders)',
          },
        },
        {
          repeatCell: {
            range: range(sheetId, 3, 5, 1, 2),
            cell: {
              userEnteredFormat: {
                backgroundColor: COLORS.white,
                horizontalAlignment: 'CENTER',
                textFormat: { bold: true, foregroundColor: COLORS.dark },
                borders: { bottom: { style: 'SOLID', color: COLORS.blue } },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat,borders)',
          },
        },
        {
          repeatCell: {
            range: range(sheetId, 6, 7, 0, 2),
            cell: { userEnteredFormat: { backgroundColor: COLORS.blue, textFormat: { bold: true, foregroundColor: COLORS.white }, horizontalAlignment: 'CENTER' } },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        },
        {
          repeatCell: {
            range: range(sheetId, 11, 12, 0, 2),
            cell: { userEnteredFormat: { backgroundColor: COLORS.yellow, textFormat: { bold: true, foregroundColor: COLORS.dark }, horizontalAlignment: 'CENTER' } },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        },
        {
          repeatCell: {
            range: range(sheetId, 18, 19, 0, 2),
            cell: { userEnteredFormat: { backgroundColor: COLORS.blue, textFormat: { bold: true, foregroundColor: COLORS.white }, horizontalAlignment: 'CENTER' } },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        },
        {
          repeatCell: {
            range: range(sheetId, 7, 17, 1, 2),
            cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: AMOUNT_FORMAT }, horizontalAlignment: 'RIGHT', textFormat: { bold: true } } },
            fields: 'userEnteredFormat(numberFormat,horizontalAlignment,textFormat)',
          },
        },
      )
    }

    const textRule = (columnIndex, text, color) => ({
      addConditionalFormatRule: {
        rule: {
          ranges: [range(sheetId, 1, 1000, columnIndex, columnIndex + 1)],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: text }] },
            format: { backgroundColor: color },
          },
        },
        index: 0,
      },
    })
    const numberRule = (columnIndex, type, value, color) => ({
      addConditionalFormatRule: {
        rule: {
          ranges: [range(sheetId, 1, 1000, columnIndex, columnIndex + 1)],
          booleanRule: {
            condition: { type, values: [{ userEnteredValue: String(value) }] },
            format: { backgroundColor: color },
          },
        },
        index: 0,
      },
    })

    if (tab === 'MEMBRES') {
      requests.push(
        textRule(7, 'Actif', COLORS.green),
        textRule(7, 'Inactif', COLORS.grey),
        textRule(7, 'Non approuve', COLORS.red),
        textRule(12, 'Non', COLORS.softYellow),
      )
    }
    if (tab === 'BUDGET') {
      requests.push(textRule(4, 'Entree', COLORS.green), textRule(4, 'Sortie', COLORS.red))
    }
    if (tab === 'BUDGET_MENSUEL' || tab === 'BUDGET_ANNUEL') {
      const soldeColumn = tab === 'BUDGET_MENSUEL' ? 4 : 3
      requests.push(numberRule(soldeColumn, 'NUMBER_GREATER_THAN_EQ', 0, COLORS.green), numberRule(soldeColumn, 'NUMBER_LESS', 0, COLORS.red))
    }
    if (tab === 'PRESENCES_DETAIL') {
      requests.push(textRule(6, 'Present', COLORS.green), textRule(6, 'Absent', COLORS.red))
    }

    if (tab === 'BUDGET') {
      requests.push({
        repeatCell: {
          range: range(sheetId, 1, 1000, 7, 8),
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: AMOUNT_FORMAT }, horizontalAlignment: 'RIGHT' } },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      })
    }
    if (tab === 'BUDGET_MENSUEL' || tab === 'BUDGET_ANNUEL') {
      const firstMoneyColumn = tab === 'BUDGET_MENSUEL' ? 2 : 1
      const lastMoneyColumn = tab === 'BUDGET_MENSUEL' ? 5 : 4
      requests.push({
        repeatCell: {
          range: range(sheetId, 1, 1000, firstMoneyColumn, lastMoneyColumn),
          cell: { userEnteredFormat: { numberFormat: { type: 'NUMBER', pattern: AMOUNT_FORMAT }, horizontalAlignment: 'RIGHT' } },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)',
        },
      })
    }

    const protectedRange = {
      range: wholeSheetRange(sheetId),
      description: tab === 'OVERVIEW'
        ? 'YFC dashboard - modifier seulement les menus deroulants'
        : 'YFC Firebase mirror - lecture seule',
      warningOnly: tab === 'OVERVIEW',
    }
    if (tab !== 'OVERVIEW') {
      protectedRange.editors = { users: [serviceAccountEmail].filter(Boolean) }
    }
    requests.push({ addProtectedRange: { protectedRange } })
  }
  return requests
}

function overviewDropdownRequests(map, options = {}) {
  const sheet = map.get('OVERVIEW')
  if (!sheet) return []
  const sheetId = sheet.properties.sheetId
  const months = options.months?.length ? options.months : ['Tous']
  const years = options.years?.length ? options.years : ['Tous']
  return [
    {
      setDataValidation: {
        range: range(sheetId, 3, 4, 1, 2),
        rule: {
          condition: { type: 'ONE_OF_LIST', values: months.map(userEnteredValue => ({ userEnteredValue })) },
          strict: true,
          showCustomUi: true,
        },
      },
    },
    {
      setDataValidation: {
        range: range(sheetId, 4, 5, 1, 2),
        rule: {
          condition: { type: 'ONE_OF_LIST', values: years.map(userEnteredValue => ({ userEnteredValue })) },
          strict: true,
          showCustomUi: true,
        },
      },
    },
  ]
}

async function prepareGoogleSheet(secrets) {
  const map = await ensureTabs(secrets)
  await valuesBatchUpdate(secrets, [
    { range: 'OVERVIEW!A1:B2', values: [['YFC - Tableau de bord', ''], ['Ce fichier est une copie automatique des donnees Firebase. Ne pas modifier manuellement.', '']] },
    ...Object.entries(HEADERS).map(([tab, headers]) => ({ range: `${tab}!A1:Z1`, values: [headers] })),
  ])
  await batchUpdate(secrets, formatRequests(map, secrets))
  await appendSyncLog(secrets, { action: 'prepareSheet', result: 'Succes', message: 'Google Sheet prepare et protege' })
  return { ok: true }
}

async function syncAllToGoogleSheets(secrets, meta = {}) {
  await prepareGoogleSheet(secrets)
  const data = await loadData()
  const rows = buildRows(data)

  for (const tab of ['OVERVIEW', 'MEMBRES', 'BUDGET', 'BUDGET_MENSUEL', 'BUDGET_ANNUEL', 'PRESENCES', 'PRESENCES_DETAIL']) {
    await valuesClear(secrets, tab)
  }

  await valuesBatchUpdate(secrets, [
    { range: 'OVERVIEW!A1:B60', values: rows.OVERVIEW },
    { range: 'MEMBRES!A1:N', values: rows.MEMBRES },
    { range: 'BUDGET!A1:L', values: rows.BUDGET },
    { range: 'BUDGET_MENSUEL!A1:F', values: rows.BUDGET_MENSUEL },
    { range: 'BUDGET_ANNUEL!A1:E', values: rows.BUDGET_ANNUEL },
    { range: 'PRESENCES!A1:I', values: rows.PRESENCES },
    { range: 'PRESENCES_DETAIL!A1:I', values: rows.PRESENCES_DETAIL },
  ])

  const map = sheetMap(await getSpreadsheet(secrets))
  await batchUpdate(secrets, overviewDropdownRequests(map, rows.options))

  await appendSyncLog(secrets, {
    action: meta.action || 'syncAllToGoogleSheets',
    collection: meta.collection || '',
    documentId: meta.documentId || '',
    result: 'Succes',
    message: `${rows.counts.membres} membres, ${rows.counts.transactions} operations budget, ${rows.counts.events} evenements synchronises`,
  })

  return { ok: true, lastSync: nowIso(), ...rows.counts }
}

async function runTriggeredSync(secrets, event, collectionName) {
  const documentId = event.params?.docId || ''
  try {
    return await syncAllToGoogleSheets(secrets, { action: 'firestoreTrigger', collection: collectionName, documentId })
  } catch (e) {
    console.error(`Google Sheets sync failed for ${collectionName}/${documentId}`, e)
    await appendSyncLog(secrets, {
      action: 'firestoreTrigger',
      collection: collectionName,
      documentId,
      result: 'Erreur',
      message: 'Echec de synchronisation Google Sheets',
      error: e.message || String(e),
    })
    return null
  }
}

module.exports = {
  prepareGoogleSheet,
  syncAllToGoogleSheets,
  runTriggeredSync,
  appendVote,
  getVoteRows,
  toDateTimeString,
  nowIso,
}
