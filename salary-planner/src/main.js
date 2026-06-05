import './style.css'

const STORAGE_KEY = 'salary-planner-state-v4'
const AUTH_TOKEN_KEY = 'salary-planner-auth-token'

const DEFAULT_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', pct: 0.08, hint: 'Food and household essentials' },
  { id: 'lifestyle', name: 'Lifestyle', pct: 0.05, hint: 'Dining, subscriptions, social plans' },
  { id: 'gold', name: 'Gold', pct: 0.1, hint: 'Gold savings or recurring purchase' },
  { id: 'small-cap-mf', name: 'Small Cap MF', pct: 0.15, hint: 'Higher-growth mutual funds' },
  { id: 'mid-cap-mf', name: 'Mid Cap MF', pct: 0.1, hint: 'Balanced growth allocation' },
  { id: 'large-cap-mf', name: 'Large Cap MF', pct: 0.05, hint: 'Core equity allocation' },
  { id: 'cash-savings', name: 'Cash Savings', pct: 0.3, hint: 'Emergency and liquid savings' },
  { id: 'parents-needs', name: 'Parents Needs', pct: 0.17, hint: 'Family support and obligations' },
]

const SPENDING_CATEGORY_IDS = new Set(['groceries', 'lifestyle'])

const months = [
  { id: 'jan', label: 'Jan' },
  { id: 'feb', label: 'Feb' },
  { id: 'mar', label: 'Mar' },
  { id: 'apr', label: 'Apr' },
  { id: 'may', label: 'May' },
  { id: 'jun', label: 'Jun' },
  { id: 'jul', label: 'Jul' },
  { id: 'aug', label: 'Aug' },
  { id: 'sep', label: 'Sep' },
  { id: 'oct', label: 'Oct' },
  { id: 'nov', label: 'Nov' },
  { id: 'dec', label: 'Dec' },
]

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function getCurrentMonthId() {
  return months[new Date().getMonth()]?.id ?? 'jan'
}

function getCurrentYear() {
  return String(new Date().getFullYear())
}

function parseAmount(value) {
  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

function formatCurrency(value) {
  return currencyFormatter.format(value)
}

function slugifyName(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return raw || 'saving-option'
}

function createEmptyYearData(categoryList) {
  return Object.fromEntries(
    months.map(({ id }) => [
      id,
      {
        salary: '',
        achieved: Object.fromEntries(categoryList.map((category) => [category.id, ''])),
      },
    ]),
  )
}

function normalizeCategories(rawCategories) {
  const source = Array.isArray(rawCategories) && rawCategories.length > 0 ? rawCategories : DEFAULT_CATEGORIES
  const usedIds = new Set()

  return source
    .map((category, index) => {
      const baseId = slugifyName(category?.id || category?.name || `category-${index + 1}`)
      let id = baseId
      let suffix = 1
      while (usedIds.has(id)) {
        id = `${baseId}-${suffix}`
        suffix += 1
      }
      usedIds.add(id)

      const pctValue = Number(category?.pct)
      const pct = Number.isFinite(pctValue) ? Math.max(0, pctValue) : 0

      return {
        id,
        name: typeof category?.name === 'string' && category.name.trim() ? category.name.trim() : `Category ${index + 1}`,
        pct,
        hint:
          typeof category?.hint === 'string' && category.hint.trim()
            ? category.hint.trim()
            : 'Custom savings option',
      }
    })
    .filter((category) => category.name)
}

function normalizeYearData(rawYearData, categoryList) {
  const fallback = createEmptyYearData(categoryList)

  if (!rawYearData || typeof rawYearData !== 'object') {
    return fallback
  }

  return Object.fromEntries(
    months.map(({ id }) => {
      const rawMonth = rawYearData[id] ?? {}

      return [
        id,
        {
          salary:
            typeof rawMonth.salary === 'string' || typeof rawMonth.salary === 'number'
              ? String(rawMonth.salary)
              : '',
          achieved: Object.fromEntries(
            categoryList.map((category) => [
              category.id,
              typeof rawMonth.achieved?.[category.id] === 'string' ||
              typeof rawMonth.achieved?.[category.id] === 'number'
                ? String(rawMonth.achieved[category.id])
                : '',
            ]),
          ),
        },
      ]
    }),
  )
}

function createDefaultState() {
  const currentYear = getCurrentYear()
  const categories = normalizeCategories(DEFAULT_CATEGORIES)

  return {
    categories,
    years: {
      [currentYear]: createEmptyYearData(categories),
    },
  }
}

function normalizeState(rawState) {
  const fallback = createDefaultState()

  if (!rawState || typeof rawState !== 'object') {
    return fallback
  }

  const categories = normalizeCategories(rawState.categories)
  const yearsInput = rawState.years && typeof rawState.years === 'object' ? rawState.years : null

  if (!yearsInput) {
    return {
      categories,
      years: {
        [getCurrentYear()]: createEmptyYearData(categories),
      },
    }
  }

  const normalizedYears = Object.fromEntries(
    Object.entries(yearsInput)
      .filter(([year]) => /^\d{4}$/.test(year))
      .map(([year, yearData]) => [year, normalizeYearData(yearData, categories)]),
  )

  if (!normalizedYears[getCurrentYear()]) {
    normalizedYears[getCurrentYear()] = createEmptyYearData(categories)
  }

  return {
    categories,
    years: Object.keys(normalizedYears).length > 0 ? normalizedYears : fallback.years,
  }
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return createDefaultState()
  }
}

function getStatus(target, achieved) {
  const normalizedTarget = Math.round(target * 100) / 100
  const normalizedAchieved = Math.round(achieved * 100) / 100

  if (normalizedTarget <= 0) {
    return { tone: 'idle', label: 'Add salary' }
  }

  if (normalizedAchieved <= 0) {
    return { tone: 'pending', label: 'Pending' }
  }

  if (normalizedAchieved >= normalizedTarget) {
    return { tone: 'complete', label: 'Covered' }
  }

  return { tone: 'partial', label: 'In progress' }
}

function isSpendingCategory(category) {
  return SPENDING_CATEGORY_IDS.has(category.id)
}

let state = loadState()
const auth = {
  token: localStorage.getItem(AUTH_TOKEN_KEY) || '',
  user: null,
  isReady: false,
  error: '',
}

const view = {
  page: auth.token ? 'dashboard' : 'login',
  selectedMonthId: getCurrentMonthId(),
  selectedYear: getCurrentYear(),
  authMode: 'login',
  profileMenuOpen: false,
}

let plannerMessage = ''

let syncTimer = null

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  scheduleRemoteSave()
}

function ensureYearExists(year) {
  if (!state.years[year]) {
    state.years[year] = createEmptyYearData(state.categories)
  }
}

function syncCategoryShapeAcrossYears() {
  Object.keys(state.years).forEach((year) => {
    state.years[year] = normalizeYearData(state.years[year], state.categories)
  })
}

function getYearOptions() {
  const currentYear = Number(getCurrentYear())
  const generatedYears = Array.from({ length: 7 }, (_, index) => String(currentYear - index))
  const savedYears = Object.keys(state.years)
  const mergedYears = [...new Set([...generatedYears, ...savedYears])]
  return mergedYears.sort((left, right) => Number(right) - Number(left))
}

function getYearData(year) {
  ensureYearExists(year)
  return state.years[year]
}

function getMonthMetrics(year, monthId) {
  const monthState = getYearData(year)[monthId]
  const salary = parseAmount(monthState.salary)

  const rows = state.categories.map((category) => {
    const target = salary * category.pct
    const achieved = parseAmount(monthState.achieved[category.id])

    return {
      ...category,
      target,
      achieved,
      status: getStatus(target, achieved),
    }
  })

  const targetTotal = rows.reduce((sum, row) => sum + row.target, 0)
  const achievedTotal = rows.reduce((sum, row) => sum + row.achieved, 0)
  const completionRate = targetTotal > 0 ? Math.min(achievedTotal / targetTotal, 1) : 0
  const spending = rows.reduce((sum, row) => sum + (isSpendingCategory(row) ? row.achieved : 0), 0)
  const savings = rows.reduce((sum, row) => sum + (isSpendingCategory(row) ? 0 : row.achieved), 0)

  return {
    salary,
    rows,
    targetTotal,
    achievedTotal,
    completionRate,
    savings,
    spending,
  }
}

function getYearMetrics(year) {
  const monthMetrics = months.map((month) => ({ ...month, ...getMonthMetrics(year, month.id) }))
  const totalSalary = monthMetrics.reduce((sum, month) => sum + month.salary, 0)
  const totalTarget = monthMetrics.reduce((sum, month) => sum + month.targetTotal, 0)
  const totalAchieved = monthMetrics.reduce((sum, month) => sum + month.achievedTotal, 0)
  const yearlySpendings = monthMetrics.reduce((sum, month) => sum + month.spending, 0)
  const yearlySavings = monthMetrics.reduce((sum, month) => sum + month.savings, 0)

  return {
    totalSalary,
    totalTarget,
    totalAchieved,
    yearlySpendings,
    yearlySavings,
    completionRate: totalTarget > 0 ? Math.min(totalAchieved / totalTarget, 1) : 0,
    activeMonths: monthMetrics.filter((month) => month.salary > 0).length,
  }
}

function getYearlyPieMetrics(year) {
  const yearMetrics = getYearMetrics(year)
  const total = yearMetrics.yearlySpendings + yearMetrics.yearlySavings
  const spendingPct = total > 0 ? Math.round((yearMetrics.yearlySpendings / total) * 100) : 50

  return {
    ...yearMetrics,
    spendingPct,
  }
}

async function loadRemoteState() {
  const response = await fetch('/api/planner-state', {
    headers: {
      Authorization: `Bearer ${auth.token}`,
    },
  })
  if (!response.ok) {
    throw new Error('Unable to load remote state')
  }

  const payload = await response.json()
  return payload.state ? normalizeState(payload.state) : null
}

async function saveRemoteState(snapshot) {
  const response = await fetch('/api/planner-state', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify({ state: snapshot }),
  })

  if (!response.ok) {
    throw new Error('Unable to save remote state')
  }
}

function scheduleRemoteSave() {
  if (!auth.user || !auth.token) {
    return
  }

  if (syncTimer) {
    clearTimeout(syncTimer)
  }

  const snapshot = normalizeState(state)
  syncTimer = setTimeout(() => {
    saveRemoteState(snapshot).catch(() => {
      // Keep local changes; retry on next update.
    })
  }, 350)
}

async function hydrateFromRemote() {
  if (!auth.user || !auth.token) {
    return
  }

  try {
    const remoteState = await loadRemoteState()
    if (!remoteState) {
      return
    }

    state = remoteState
    ensureYearExists(view.selectedYear)
    render()
  } catch {
    // Keep local state when API is unavailable.
  }
}

async function authenticate(endpoint, email, password) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Authentication failed')
  }

  auth.token = payload.token
  auth.user = payload.user
  auth.error = ''
  localStorage.setItem(AUTH_TOKEN_KEY, auth.token)
}

async function initializeAuthSession() {
  if (!auth.token) {
    auth.isReady = true
    view.page = 'login'
    return
  }

  try {
    const response = await fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${auth.token}`,
      },
    })

    if (!response.ok) {
      throw new Error('Session expired')
    }

    const payload = await response.json()
    auth.user = payload.user
    auth.error = ''
    view.page = view.page === 'login' ? 'dashboard' : view.page
    await hydrateFromRemote()
  } catch {
    auth.token = ''
    auth.user = null
    auth.error = 'Please log in to sync your planner across devices.'
    localStorage.removeItem(AUTH_TOKEN_KEY)
    view.page = 'login'
  } finally {
    auth.isReady = true
    plannerMessage = ''
  }
}

function getCategoryPctTotal() {
  return state.categories.reduce((sum, category) => sum + category.pct, 0)
}

function getAuthMessageState() {
  if (!auth.error) {
    return {
      text: 'Use the same account to access your data everywhere.',
      tone: 'neutral',
    }
  }

  const normalized = auth.error.toLowerCase()
  if (normalized.includes('success')) {
    return {
      text: auth.error,
      tone: 'success',
    }
  }

  return {
    text: auth.error,
    tone: 'error',
  }
}

function renderLoginPage() {
  const isLogin = view.authMode === 'login'
  const authMessage = getAuthMessageState()

  return `
    <section class="login-page">
      <article class="login-card">
        <p class="eyebrow">Account</p>
        <h1>${isLogin ? 'Welcome back' : 'Create your planner account'}</h1>
        <p class="hero-text">Login from any device and your planner data will follow your account.</p>

        <div class="auth-mode-switch">
          <button type="button" class="auth-mode ${isLogin ? 'is-active' : ''}" data-auth-mode="login">Login</button>
          <button type="button" class="auth-mode ${!isLogin ? 'is-active' : ''}" data-auth-mode="register">Register</button>
        </div>

        <div class="auth-fields">
          <input id="auth-email" type="email" placeholder="Email" autocomplete="email" />
          <input id="auth-password" type="password" placeholder="Password (min 8 chars)" autocomplete="current-password" />
          <button type="button" class="action-button action-button--primary auth-submit" data-auth-submit>
            ${isLogin ? 'Login' : 'Create Account'}
          </button>
        </div>
        <p class="auth-message auth-message--${authMessage.tone}">${authMessage.text}</p>
      </article>
    </section>
  `
}

function renderTopNav() {
  return `
    <header class="auth-panel auth-panel--ready">
      <div class="profile-menu ${view.profileMenuOpen ? 'is-open' : ''}">
        <button
          type="button"
          class="profile-trigger"
          aria-label="Open account menu"
          aria-expanded="${view.profileMenuOpen ? 'true' : 'false'}"
          data-profile-toggle
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20a8 8 0 1 1 16 0z" />
          </svg>
        </button>
        <div class="profile-dropdown">
          <p class="profile-title">Signed in as</p>
          <p class="profile-email">${auth.user?.email || ''}</p>
          <button type="button" class="action-button action-button--ghost profile-logout" data-auth-logout>Logout</button>
        </div>
      </div>
    </header>
    <nav class="top-nav">
      <button type="button" data-nav="dashboard" class="top-nav__link ${view.page === 'dashboard' ? 'is-active' : ''}">Dashboard</button>
      <button type="button" data-nav="month" class="top-nav__link ${view.page === 'month' ? 'is-active' : ''}">Month Planner</button>
      <button type="button" data-nav="settings" class="top-nav__link ${view.page === 'settings' ? 'is-active' : ''}">Planner Settings</button>
    </nav>
  `
}

function renderDashboard() {
  const yearly = getYearlyPieMetrics(view.selectedYear)

  return `
    <section class="dashboard-page">
      <header class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Overview</p>
          <h1>Yearly savings and spendings overview.</h1>
          <p class="hero-text">The chart now shows your full-year split, not just a single month.</p>
        </div>

        <aside class="pie-card">
          <p class="eyebrow">Yearly split: ${view.selectedYear}</p>
          <div class="pie-wrap">
            <div class="pie-chart" style="--spending-angle:${yearly.spendingPct}%">
              <div class="pie-inner">
                <strong>${yearly.spendingPct}%</strong>
                <span>Spent</span>
              </div>
            </div>
            <div class="legend-list">
              <div>
                <span class="legend-dot legend-dot--spending"></span>
                <p>Yearly spendings</p>
                <strong>${formatCurrency(yearly.yearlySpendings)}</strong>
              </div>
              <div>
                <span class="legend-dot legend-dot--savings"></span>
                <p>Yearly savings</p>
                <strong>${formatCurrency(yearly.yearlySavings)}</strong>
              </div>
              <div>
                <span class="legend-dot legend-dot--salary"></span>
                <p>Yearly salary</p>
                <strong>${formatCurrency(yearly.totalSalary)}</strong>
              </div>
            </div>
          </div>
        </aside>
      </header>

      <section class="summary-grid">
        <article class="summary-card">
          <p>Total salary added</p>
          <strong>${formatCurrency(yearly.totalSalary)}</strong>
          <span>${yearly.activeMonths} months with salary data in ${view.selectedYear}</span>
        </article>
        <article class="summary-card">
          <p>Total saved</p>
          <strong>${formatCurrency(yearly.yearlySavings)}</strong>
          <span>Remaining after total spending for ${view.selectedYear}</span>
        </article>
        <article class="summary-card">
          <p>Total spending</p>
          <strong>${formatCurrency(yearly.yearlySpendings)}</strong>
          <span>Amount spent from salary entries in ${view.selectedYear}</span>
        </article>
      </section>
    </section>
  `
}

function renderMonthPage(year, monthId) {
  const selected = months.find((month) => month.id === monthId) ?? months[0]
  const metrics = getMonthMetrics(year, selected.id)

  return `
    <section class="month-page">
      <header class="month-header">
        <div>
          <p class="eyebrow">Month Page</p>
          <h1>${selected.label} Planner (${year})</h1>
        </div>
        <div class="month-header__right">
          <label for="month-selector-month">Month</label>
          <select id="month-selector-month" data-month-selector>
            ${months
              .map(
                (month) =>
                  `<option value="${month.id}" ${month.id === selected.id ? 'selected' : ''}>${month.label}</option>`,
              )
              .join('')}
          </select>
          <label for="year-selector-month">Year</label>
          <select id="year-selector-month" data-year-selector>
            ${getYearOptions()
              .map(
                (yearOption) =>
                  `<option value="${yearOption}" ${yearOption === year ? 'selected' : ''}>${yearOption}</option>`,
              )
              .join('')}
          </select>
          <button type="button" class="action-button action-button--ghost" data-nav="dashboard">Back to Dashboard</button>
        </div>
      </header>

      <section class="month-overview">
        <label class="salary-field">
          <span>Monthly salary</span>
          <input
            class="salary-input"
            type="number"
            min="0"
            inputmode="decimal"
            placeholder="0"
            value="${getYearData(year)[selected.id].salary}"
            data-salary-input="${selected.id}"
          />
        </label>
        <article class="mini-card">
          <p>Planned total</p>
          <strong>${formatCurrency(metrics.targetTotal)}</strong>
        </article>
        <article class="mini-card">
          <p>Achieved total</p>
          <strong>${formatCurrency(metrics.achievedTotal)}</strong>
        </article>
        <article class="mini-card">
          <p>Completion</p>
          <strong>${Math.round(metrics.completionRate * 100)}%</strong>
        </article>
      </section>

      <section class="progress-panel">
        <div class="progress-track">
          <span class="progress-fill" style="width:${metrics.completionRate * 100}%"></span>
        </div>
      </section>

      <section class="category-grid" aria-label="${selected.label} category plan">
        <div class="category-grid__head">
          <span>Category</span>
          <span>Split</span>
          <span>Target</span>
          <span>Achieved</span>
          <span>Status</span>
        </div>

        ${metrics.rows
          .map(
            (row) => `
              <div class="category-row">
                <div>
                  <strong>${row.name}</strong>
                  <p>${row.hint}</p>
                </div>
                <span>${Math.round(row.pct * 100)}%</span>
                <strong>${formatCurrency(row.target)}</strong>
                <label>
                  <span class="sr-only">${row.name} achieved value</span>
                  <input
                    class="achieved-input"
                    type="number"
                    min="0"
                    inputmode="decimal"
                    placeholder="0"
                    value="${getYearData(year)[selected.id].achieved[row.id]}"
                    data-achieved-input="${selected.id}:${row.id}"
                  />
                </label>
                <span class="status-pill status-pill--${row.status.tone}">${row.status.label}</span>
              </div>
            `,
          )
          .join('')}
      </section>
    </section>
  `
}

function renderSettingsPage() {
  const totalPct = getCategoryPctTotal()
  const pctDisplay = Math.round(totalPct * 100)

  return `
    <section class="settings-page">
      <header class="settings-header">
        <p class="eyebrow">Planner Settings</p>
        <h1>Reset planner and manage savings options</h1>
        <p class="hero-text">Update percentages, add options like Home, or remove options. Changes apply to all months in every year.</p>
      </header>

      <section class="settings-card">
        <h2>Savings options</h2>
        <p class="settings-total ${pctDisplay === 100 ? 'is-good' : 'is-warning'}">Total percentage: ${pctDisplay}%</p>
        <p class="settings-message">${plannerMessage || 'Tip: keep total close to 100% for a balanced split.'}</p>
        <div class="settings-grid-head">
          <span>Name</span>
          <span>Percentage</span>
          <span>Action</span>
        </div>
        ${state.categories
          .map(
            (category) => `
              <div class="settings-row">
                <input type="text" value="${category.name}" data-category-name="${category.id}" />
                <input type="number" min="0" step="0.1" value="${(category.pct * 100).toFixed(1)}" data-category-pct="${category.id}" />
                <button type="button" class="action-button action-button--ghost" data-remove-category="${category.id}">Remove</button>
              </div>
            `,
          )
          .join('')}

        <div class="settings-add-row">
          <input id="new-category-name" type="text" placeholder="New option name (e.g. Home)" />
          <input id="new-category-pct" type="number" min="0" step="0.1" placeholder="Percentage" />
          <button type="button" class="action-button action-button--primary" data-add-category>Add Option</button>
        </div>
      </section>

      <section class="settings-card">
        <h2>Reset planner data</h2>
        <p class="hero-text">This clears all monthly salary and achieved amounts but keeps your current savings options.</p>
        <button type="button" class="action-button action-button--ghost" data-reset-data>Reset All Planner Data</button>
      </section>
    </section>
  `
}

function render() {
  const app = document.querySelector('#app')

  if (!auth.isReady) {
    app.innerHTML = `
      <div class="page-shell">
        <section class="auth-panel">
          <p>Checking session...</p>
        </section>
      </div>
    `
    return
  }

  if (!auth.user) {
    view.page = 'login'
    app.innerHTML = `<div class="page-shell">${renderLoginPage()}</div>`
    return
  }

  ensureYearExists(view.selectedYear)

  const pageContent =
    view.page === 'month'
      ? renderMonthPage(view.selectedYear, view.selectedMonthId)
      : view.page === 'settings'
        ? renderSettingsPage()
        : renderDashboard()

  app.innerHTML = `
    <div class="page-shell">
      ${renderTopNav()}
      ${pageContent}
    </div>
  `
}

function resetPlannerData() {
  const updatedYears = Object.fromEntries(
    Object.keys(state.years).map((year) => [year, createEmptyYearData(state.categories)]),
  )
  state = {
    ...state,
    years: updatedYears,
  }
  saveState()
  render()
}

function addCategory(nameValue, pctValue) {
  const name = String(nameValue || '').trim()
  const pctPercent = Number.parseFloat(String(pctValue || '').trim())
  if (!name || !Number.isFinite(pctPercent) || pctPercent < 0) {
    return false
  }

  const baseId = slugifyName(name)
  let id = baseId
  let suffix = 1
  while (state.categories.some((category) => category.id === id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  state.categories.push({
    id,
    name,
    pct: pctPercent / 100,
    hint: 'Custom savings option',
  })
  plannerMessage = `Added ${name}.`
  syncCategoryShapeAcrossYears()
  saveState()
  render()
  return true
}

function removeCategory(categoryId) {
  if (state.categories.length <= 1) {
    return false
  }

  const removed = state.categories.find((category) => category.id === categoryId)
  state.categories = state.categories.filter((category) => category.id !== categoryId)
  plannerMessage = removed ? `Removed ${removed.name}.` : 'Savings option removed.'
  syncCategoryShapeAcrossYears()
  saveState()
  render()
  return true
}

function updateCategoryName(categoryId, value) {
  const category = state.categories.find((entry) => entry.id === categoryId)
  if (!category) {
    return
  }
  const nextName = String(value || '').trim()
  if (nextName && nextName !== category.name) {
    plannerMessage = `Updated name to ${nextName}.`
  }
  category.name = nextName || category.name
  saveState()
  render()
}

function updateCategoryPct(categoryId, value) {
  const category = state.categories.find((entry) => entry.id === categoryId)
  if (!category) {
    return
  }
  const pctPercent = Number.parseFloat(value)
  category.pct = Number.isFinite(pctPercent) && pctPercent >= 0 ? pctPercent / 100 : 0
  plannerMessage = `${category.name} set to ${(category.pct * 100).toFixed(1)}%.`
  saveState()
  render()
}

function bindEvents() {
  const app = document.querySelector('#app')

  app.addEventListener('change', (event) => {
    const salaryTarget = event.target.closest('[data-salary-input]')
    if (salaryTarget) {
      const monthId = salaryTarget.dataset.salaryInput
      getYearData(view.selectedYear)[monthId].salary = salaryTarget.value
      saveState()
      render()
      return
    }

    const achievedTarget = event.target.closest('[data-achieved-input]')
    if (achievedTarget) {
      const [monthId, categoryId] = achievedTarget.dataset.achievedInput.split(':')
      getYearData(view.selectedYear)[monthId].achieved[categoryId] = achievedTarget.value
      saveState()
      render()
      return
    }

    const yearSelector = event.target.closest('[data-year-selector]')
    if (yearSelector) {
      view.selectedYear = yearSelector.value
      ensureYearExists(view.selectedYear)
      saveState()
      render()
      return
    }

    const monthSelector = event.target.closest('[data-month-selector]')
    if (monthSelector) {
      view.selectedMonthId = monthSelector.value
      render()
      return
    }

    const categoryNameInput = event.target.closest('[data-category-name]')
    if (categoryNameInput) {
      updateCategoryName(categoryNameInput.dataset.categoryName, categoryNameInput.value)
      return
    }

    const categoryPctInput = event.target.closest('[data-category-pct]')
    if (categoryPctInput) {
      updateCategoryPct(categoryPctInput.dataset.categoryPct, categoryPctInput.value)
    }
  })

  app.addEventListener('click', async (event) => {
    let closedProfileMenu = false

    if (view.profileMenuOpen && !event.target.closest('.profile-menu')) {
      view.profileMenuOpen = false
      closedProfileMenu = true
    }

    const profileToggle = event.target.closest('[data-profile-toggle]')
    if (profileToggle) {
      view.profileMenuOpen = !view.profileMenuOpen
      render()
      return
    }

    const authModeButton = event.target.closest('[data-auth-mode]')
    if (authModeButton) {
      view.authMode = authModeButton.dataset.authMode
      auth.error = ''
      plannerMessage = ''
      view.profileMenuOpen = false
      render()
      return
    }

    const authSubmit = event.target.closest('[data-auth-submit]')
    if (authSubmit) {
      const emailInput = document.querySelector('#auth-email')
      const passwordInput = document.querySelector('#auth-password')
      const email = (emailInput?.value || '').trim()
      const password = passwordInput?.value || ''

      if (!email || !password) {
        auth.error = 'Email and password are required.'
        render()
        return
      }

      try {
        await authenticate(
          view.authMode === 'login' ? '/api/auth/login' : '/api/auth/register',
          email,
          password,
        )
        view.page = 'dashboard'
        view.profileMenuOpen = false
        await hydrateFromRemote()
        render()
      } catch (error) {
        auth.error = error.message
        render()
      }
      return
    }

    const authLogout = event.target.closest('[data-auth-logout]')
    if (authLogout) {
      auth.token = ''
      auth.user = null
      auth.error = 'Logged out successfully.'
      plannerMessage = ''
      localStorage.removeItem(AUTH_TOKEN_KEY)
      view.page = 'login'
      view.profileMenuOpen = false
      render()
      return
    }

    const navButton = event.target.closest('[data-nav]')
    if (navButton) {
      view.page = navButton.dataset.nav
      plannerMessage = ''
      view.profileMenuOpen = false
      render()
      return
    }

    const addCategoryButton = event.target.closest('[data-add-category]')
    if (addCategoryButton) {
      const nameInput = document.querySelector('#new-category-name')
      const pctInput = document.querySelector('#new-category-pct')
      const added = addCategory(nameInput?.value, pctInput?.value)
      if (!added) {
        plannerMessage = 'Please provide a valid option name and percentage.'
        render()
      } else {
        if (nameInput) {
          nameInput.value = ''
        }
        if (pctInput) {
          pctInput.value = ''
        }
      }
      return
    }

    const removeCategoryButton = event.target.closest('[data-remove-category]')
    if (removeCategoryButton) {
      if (window.confirm('Remove this savings option from all years?')) {
        const removed = removeCategory(removeCategoryButton.dataset.removeCategory)
        if (!removed) {
          plannerMessage = 'At least one savings option is required.'
          render()
        }
      }
      return
    }

    const resetDataButton = event.target.closest('[data-reset-data]')
    if (resetDataButton) {
      if (window.confirm('Reset all planner yearly/monthly amounts? This cannot be undone.')) {
        resetPlannerData()
        plannerMessage = 'Planner values reset. Savings options were kept.'
        render()
      }
      return
    }

    if (closedProfileMenu) {
      render()
    }
  })
}

render()
bindEvents()
initializeAuthSession().then(() => {
  render()
})