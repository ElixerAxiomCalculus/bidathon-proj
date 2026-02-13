const BASE_URL = 'https://bidathon-proj.onrender.com';

const TOKEN_KEY = 'finally_token';
const USER_KEY = 'finally_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export const getUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
};
export const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));
export const clearUser = () => localStorage.removeItem(USER_KEY);

export const logout = () => { clearToken(); clearUser(); };

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => ({}));
    if (!path.includes('/auth/login') && !path.includes('/auth/signup')) {
      logout();
    }
    throw new Error(body.detail || `Authentication error ${res.status}`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `API error ${res.status}`);
  }
  return res.json();
}

function qs(params) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v != null) s.set(k, v); });
  return s.toString() ? `?${s}` : '';
}

export const healthCheck = () => request('/');


export const signup = (name, email, phone, password) =>
  request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, phone, password }),
  });

export const login = async (email, password) => {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    setToken(data.token);
    if (data.user) setUser(data.user);
  }
  return data;
};

export const loginOtp = async (email) => {
  return request('/api/auth/login-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const verifyOtp = async (email, otp) => {
  const data = await request('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
  if (data.token) {
    setToken(data.token);
    if (data.user) setUser(data.user);
  }
  return data;
};

export const resendOtp = (email) =>
  request('/api/auth/resend-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });


export const getProfile = () => request('/api/auth/profile');

export const updateProfile = (updates) =>
  request('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

export const changePassword = (currentPassword, newPassword) =>
  request('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

export const deleteAccount = () =>
  request('/api/auth/account', { method: 'DELETE' });


export const getWatchlist = () => request('/api/auth/watchlist');

export const setWatchlist = (tickers) =>
  request('/api/auth/watchlist', {
    method: 'PUT',
    body: JSON.stringify({ tickers }),
  });

export const addToWatchlist = (ticker) =>
  request('/api/auth/watchlist/add', {
    method: 'POST',
    body: JSON.stringify({ ticker }),
  });

export const removeFromWatchlist = (ticker) =>
  request(`/api/auth/watchlist/${encodeURIComponent(ticker)}`, { method: 'DELETE' });


export const getConversations = () => request('/api/auth/conversations');

export const getConversation = (id) => request(`/api/auth/conversations/${id}`);

export const createConversation = () =>
  request('/api/auth/conversations', { method: 'POST' });

export const deleteConversation = (id) =>
  request(`/api/auth/conversations/${id}`, { method: 'DELETE' });

export const clearAllConversations = () =>
  request('/api/auth/conversations', { method: 'DELETE' });

export const generateChatTitle = (id) =>
  request(`/api/auth/conversations/${id}/generate-title`, { method: 'POST' });

export const addMessageToConversation = (id, role, content) =>
  request(`/api/auth/conversations/${id}/message`, {
    method: 'POST',
    body: JSON.stringify({ role, content }),
  });


export const agentQuery = (query, language = 'en') =>
  request('/api/agent/query', {
    method: 'POST',
    body: JSON.stringify({ query, language }),
  });


export const searchStocks = (q) =>
  request(`/api/stocks/search${qs({ q })}`);

export const getStockQuote = (ticker) =>
  request(`/api/stocks/${encodeURIComponent(ticker)}/quote`);

export const getStockHistory = (ticker, period, interval) =>
  request(`/api/stocks/${encodeURIComponent(ticker)}/history${qs({ period, interval })}`);

export const getCompanyInfo = (ticker) =>
  request(`/api/stocks/${encodeURIComponent(ticker)}/info`);

export const getMarketOverview = () =>
  request('/api/market/overview');

export const getMarketTrend = (ticker, period, interval) =>
  request(`/api/market/trend/${encodeURIComponent(ticker)}${qs({ period, interval })}`);

export const calcSIP = (monthlyInvestment, annualReturnRate, years) =>
  request('/api/calc/sip', {
    method: 'POST',
    body: JSON.stringify({
      monthly_investment: monthlyInvestment,
      annual_return_rate: annualReturnRate,
      years,
    }),
  });

export const calcEMI = (principal, annualInterestRate, tenureMonths) =>
  request('/api/calc/emi', {
    method: 'POST',
    body: JSON.stringify({
      principal,
      annual_interest_rate: annualInterestRate,
      tenure_months: tenureMonths,
    }),
  });

export const calcCompound = (principal, annualRate, years, compoundingFrequency) =>
  request('/api/calc/compound', {
    method: 'POST',
    body: JSON.stringify({
      principal,
      annual_rate: annualRate,
      years,
      compounding_frequency: compoundingFrequency,
    }),
  });

export const checkUrls = (urls) =>
  request('/api/urls/check', {
    method: 'POST',
    body: JSON.stringify({ urls }),
  });

export const listUrls = () =>
  request('/api/urls/');

export const removeUrl = (url) =>
  request(`/api/urls/${qs({ url })}`, { method: 'DELETE' });

export const scrapeUrls = (urls) =>
  request('/api/scraper/scrape', {
    method: 'POST',
    body: JSON.stringify({ urls }),
  });

export const scrapeCsv = (limit) =>
  request(`/api/scraper/scrape-csv${qs({ limit })}`, { method: 'POST' });

export const getScrapedData = () =>
  request('/api/scraper/data');

export const searchScrapedData = (q, limit) =>
  request(`/api/scraper/data/search${qs({ q, limit })}`);

export const getScrapedByUrl = (url) =>
  request(`/api/scraper/data/${encodeURIComponent(url)}`);

export const deleteScrapedByUrl = (url) =>
  request(`/api/scraper/data/${encodeURIComponent(url)}`, { method: 'DELETE' });

export const getScraperStats = () =>
  request('/api/scraper/stats');


export const getWalletBalance = () =>
  request('/api/auth/wallet');

export const addWalletFunds = (amount) =>
  request('/api/auth/wallet/add', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });


export const previewOrder = (ticker, side, quantity) =>
  request('/api/trading/order/preview', {
    method: 'POST',
    body: JSON.stringify({ ticker, side, quantity }),
  });

export const executeOrder = (ticker, side, quantity) =>
  request('/api/trading/order/execute', {
    method: 'POST',
    body: JSON.stringify({ ticker, side, quantity, confirmed: true }),
  });

export const getTradingHoldings = () =>
  request('/api/trading/holdings');

export const getTradingPortfolio = () =>
  request('/api/trading/portfolio');

export const getTradingOrders = () =>
  request('/api/trading/orders');

export const getTradingTrades = () =>
  request('/api/trading/trades');

export const getTradingBalance = () =>
  request('/api/trading/balance');


// ── Quant Terminal ──────────────────────────────────────────

export const getQuantStrategies = () =>
  request('/api/quant/strategies');

export const runQuantStrategy = (ticker, strategy, period = '6mo', interval = '1d', params = {}) =>
  request('/api/quant/run', {
    method: 'POST',
    body: JSON.stringify({ ticker, strategy, period, interval, params }),
  });

export const runQuantBacktest = (ticker, strategy, period = '1y', interval = '1d', initialCapital = 100000, params = {}) =>
  request('/api/quant/backtest', {
    method: 'POST',
    body: JSON.stringify({ ticker, strategy, period, interval, initial_capital: initialCapital, params }),
  });

export const getQuantInsight = (ticker, strategy, metrics, signalsSummary = {}) =>
  request('/api/quant/insight', {
    method: 'POST',
    body: JSON.stringify({ ticker, strategy, metrics, signals_summary: signalsSummary }),
  });

export const getQuantDrawings = (ticker) =>
  request(`/api/quant/drawings/${encodeURIComponent(ticker)}`);

export const saveQuantDrawings = (ticker, drawings) =>
  request('/api/quant/drawings', {
    method: 'POST',
    body: JSON.stringify({ ticker, drawings }),
  });

export const deleteQuantDrawings = (ticker) =>
  request(`/api/quant/drawings/${encodeURIComponent(ticker)}`, { method: 'DELETE' });

export const WS_BASE = BASE_URL.replace('http', 'ws');

export const createQuantWebSocket = (ticker) =>
  new WebSocket(`${WS_BASE}/api/quant/ws/live/${encodeURIComponent(ticker)}`);

/**
 * Stream strategy execution via SSE.
 * @param {string} ticker
 * @param {string} strategy
 * @param {string} period
 * @param {string} interval
 * @param {object} params — strategy params
 * @param {function} onStep — called with each step event {step, total, title, detail, progress, ...}
 * @param {function} onComplete — called with final result {signals, metrics, indicator_data, output_type, output}
 * @param {function} onError — called with error string
 * @returns {function} close — call to abort the stream
 */
export const streamQuantStrategy = (ticker, strategy, period, interval, params, onStep, onComplete, onError) => {
  const qs = new URLSearchParams({
    ticker, strategy, period, interval,
    params: JSON.stringify(params || {}),
  });
  const url = `${BASE_URL}/api/quant/stream/run?${qs.toString()}`;
  const es = new EventSource(url);

  es.addEventListener('step', (e) => {
    try { onStep(JSON.parse(e.data)); } catch { }
  });

  es.addEventListener('complete', (e) => {
    try { onComplete(JSON.parse(e.data)); } catch { }
    es.close();
  });

  es.addEventListener('error', (e) => {
    if (e.data) {
      try { onError(JSON.parse(e.data).error || 'Stream error'); } catch { onError('Stream error'); }
    }
    es.close();
  });

  es.onerror = () => {
    onError && onError('Connection lost');
    es.close();
  };

  return () => es.close();
};
