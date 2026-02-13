import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMarketOverview,
  getStockQuote,
  getWatchlist as fetchUserWatchlist,
  setWatchlist as apiSetWatchlist,
  addToWatchlist as apiAddToWatchlist,
  removeFromWatchlist as apiRemoveFromWatchlist,
  searchStocks,
  getTradingHoldings,
} from '../../services/api';
import './MarketPanel.css';

const DEFAULT_WATCHLIST = [
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS',
  'ICICIBANK.NS', 'WIPRO.NS', 'SBIN.NS', 'TATAMOTORS.NS',
];

const MAX_WATCHLIST = 10;

const INDEX_LABEL_MAP = {
  '^NSEI': 'NIFTY 50',
  '^BSESN': 'SENSEX',
  '^GSPC': 'S&P 500',
  '^IXIC': 'NASDAQ',
  '^DJI': 'DOW JONES',
  'BTC-USD': 'BITCOIN',
  'GC=F': 'GOLD',
  'CL=F': 'CRUDE OIL',
};

const formatNum = (n, currency = 'INR') => {
  if (n == null) return '—';
  if (currency === 'INR') return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatVol = (v) => {
  if (v == null) return '—';
  if (v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
};

const MarketPanel = ({ isOpen, onClose }) => {
  const [indices, setIndices] = useState([]);
  const [watchlistTickers, setWatchlistTickers] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [time, setTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [splitRatio, setSplitRatio] = useState(0.45);
  const [addTicker, setAddTicker] = useState('');
  const [addError, setAddError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef(null);
  const dropdownRef = useRef(null);
  const panelBodyRef = useRef(null);
  const isDragging = useRef(false);
  const panelRef = useRef(null);
  const [panelWidth, setPanelWidth] = useState(300);
  const isResizing = useRef(false);
  const [bottomTab, setBottomTab] = useState('watchlist');
  const [holdings, setHoldings] = useState([]);
  const [holdingsLoading, setHoldingsLoading] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX || e.touches?.[0]?.clientX;
    const startWidth = panelRef.current?.offsetWidth || panelWidth;

    const onMove = (ev) => {
      if (!isResizing.current) return;
      const cx = ev.clientX || ev.touches?.[0]?.clientX;
      const newWidth = Math.min(600, Math.max(250, startWidth + (startX - cx)));
      setPanelWidth(newWidth);
    };

    const onUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }, [panelWidth]);

  const handleSearchInput = (value) => {
    setAddTicker(value);
    setAddError('');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!value.trim() || value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchStocks(value.trim());
        const filtered = (results || []).filter(
          (r) => r.symbol && !watchlistTickers.includes(r.symbol)
        );
        setSuggestions(filtered.slice(0, 8));
        setShowDropdown(filtered.length > 0);
      } catch {
        setSuggestions([]);
        setShowDropdown(false);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
  };

  const handleSelectSuggestion = async (ticker) => {
    if (watchlistTickers.length >= MAX_WATCHLIST) {
      setAddError(`Max ${MAX_WATCHLIST} stocks`);
      setShowDropdown(false);
      return;
    }
    setShowDropdown(false);
    setSuggestions([]);
    setAddTicker('');
    try {
      await apiAddToWatchlist(ticker);
      setWatchlistTickers((prev) => [...prev, ticker]);
    } catch (err) {
      setAddError(err.message || 'Failed to add');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchUserWatchlist();
        if (data.watchlist && data.watchlist.length > 0) {
          setWatchlistTickers(data.watchlist);
        } else {
          setWatchlistTickers(DEFAULT_WATCHLIST);
          try { await apiSetWatchlist(DEFAULT_WATCHLIST); } catch { /* server may be down */ }
        }
      } catch {
        setWatchlistTickers(DEFAULT_WATCHLIST);
      }
    })();
  }, []);

  const fetchMarketData = useCallback(async () => {
    try {
      const data = await getMarketOverview();
      setIndices(
        data.map((item) => ({
          symbol: INDEX_LABEL_MAP[item.ticker] || item.name,
          name: item.name,
          value: item.price,
          change: item.change,
          changePercent: item.change_pct,
          positive: item.change >= 0,
          currency: item.currency,
        }))
      );
      setError(null);
    } catch (e) {
      setError('Market data unavailable');
    }
  }, []);

  const fetchWatchlistQuotes = useCallback(async () => {
    if (watchlistTickers.length === 0) return;
    try {
      const results = await Promise.allSettled(
        watchlistTickers.map((t) => getStockQuote(t))
      );
      setWatchlist(
        watchlistTickers.map((t, i) => {
          const label = t.replace('.NS', '').replace('.BO', '');
          const r = results[i];
          if (r.status === 'fulfilled' && r.value) {
            const q = r.value;
            const change = q.price && q.previous_close ? q.price - q.previous_close : 0;
            const changePct = q.previous_close ? (change / q.previous_close) * 100 : 0;
            return {
              ticker: t,
              symbol: label,
              name: q.name || label,
              price: q.price,
              change: changePct,
              positive: changePct >= 0,
              volume: q.volume,
              currency: q.currency || 'INR',
            };
          }
          return { ticker: t, symbol: label, name: label, price: null, change: 0, positive: true, volume: null, currency: 'INR' };
        })
      );
    } catch {
    }
  }, [watchlistTickers]);

  const fetchHoldings = useCallback(async () => {
    setHoldingsLoading(true);
    try {
      const data = await getTradingHoldings();
      setHoldings(Array.isArray(data) ? data : (data?.holdings || []));
    } catch {
      setHoldings([]);
    } finally {
      setHoldingsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchMarketData(), fetchWatchlistQuotes(), fetchHoldings()]);
      setLoading(false);
    };
    init();
    const interval = setInterval(() => {
      fetchMarketData();
      fetchWatchlistQuotes();
      fetchHoldings();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchMarketData, fetchWatchlistQuotes, fetchHoldings]);

  const handleAddTicker = async () => {
    const ticker = addTicker.trim().toUpperCase();
    if (!ticker) return;
    if (watchlistTickers.length >= MAX_WATCHLIST) {
      setAddError(`Max ${MAX_WATCHLIST} stocks`);
      return;
    }
    if (watchlistTickers.includes(ticker)) {
      setAddError('Already in watchlist');
      return;
    }
    setAddError('');
    try {
      await apiAddToWatchlist(ticker);
      setWatchlistTickers((prev) => [...prev, ticker]);
      setAddTicker('');
    } catch (err) {
      setAddError(err.message || 'Failed to add');
    }
  };

  const handleRemoveTicker = async (ticker) => {
    setWatchlistTickers((prev) => prev.filter((t) => t !== ticker));
    setWatchlist((prev) => prev.filter((s) => s.ticker !== ticker));
    try {
      await apiRemoveFromWatchlist(ticker);
    } catch {
      // Idempotent – local state already updated
    }
  };

  const formatTime = useCallback((d) => {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }, []);

  const isMarketOpen = () => {
    const h = time.getHours();
    const m = time.getMinutes();
    const total = h * 60 + m;
    return total >= 555 && total <= 930;
  };

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!isDragging.current || !panelBodyRef.current) return;
      const rect = panelBodyRef.current.getBoundingClientRect();
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const y = clientY - rect.top;
      const ratio = Math.max(0.15, Math.min(0.85, y / rect.height));
      setSplitRatio(ratio);
    };

    const onUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }, []);

  return (
    <>
      {isOpen && <div className="market-backdrop" onClick={onClose} />}

      <aside
        className={`market-panel ${isOpen ? 'market-panel--open' : ''}`}
        ref={panelRef}
        style={{ width: panelWidth, minWidth: panelWidth }}
      >
        <div
          className="market-panel__resize-grip"
          onMouseDown={handleResizeStart}
          onTouchStart={handleResizeStart}
        />
        <div className="market-panel__header">
          <div className="market-panel__header-left">
            <h3 className="market-panel__title">Markets</h3>
            <div className={`market-panel__status ${isMarketOpen() ? 'market-panel__status--open' : ''}`}>
              <span className="market-panel__status-dot" />
              <span className="market-panel__status-text">
                {isMarketOpen() ? 'Live' : 'Closed'}
              </span>
            </div>
          </div>
          <span className="market-panel__time">{formatTime(time)}</span>
        </div>

        <div className="market-panel__resizable-body" ref={panelBodyRef}>

        <div className="market-panel__section market-panel__section--indices" style={{ flex: `0 0 ${splitRatio * 100}%` }}>
          <h4 className="market-panel__section-title">Indices</h4>
          {loading ? (
            <div className="market-panel__loading">Loading market data...</div>
          ) : error ? (
            <div className="market-panel__error">{error}</div>
          ) : (
            <div className="market-panel__indices">
              {indices.map((item) => (
                <div key={item.symbol} className="market-panel__index">
                  <div className="market-panel__index-top">
                    <span className="market-panel__index-symbol">{item.symbol}</span>
                    <span className={`market-panel__index-change ${item.positive ? 'market-panel__index-change--up' : 'market-panel__index-change--down'}`}>
                      {item.positive ? '+' : ''}{item.changePercent?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="market-panel__index-bottom">
                    <span className="market-panel__index-value">
                      {formatNum(item.value, item.currency === 'USD' ? 'USD' : 'INR')}
                    </span>
                    <span className={`market-panel__index-diff ${item.positive ? 'market-panel__index-diff--up' : 'market-panel__index-diff--down'}`}>
                      {item.positive ? '+' : ''}{item.change?.toFixed(2)}
                    </span>
                  </div>
                  <div className="market-panel__index-bar">
                    <div
                      className={`market-panel__index-bar-fill ${item.positive ? 'market-panel__index-bar-fill--up' : 'market-panel__index-bar-fill--down'}`}
                      style={{ width: `${Math.min(Math.abs(item.changePercent || 0) * 50, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className="market-panel__divider market-panel__divider--draggable"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <span className="market-panel__divider-grip" />
        </div>

        <div className="market-panel__section market-panel__section--watchlist" style={{ flex: `0 0 ${(1 - splitRatio) * 100}%` }}>
          <div className="market-panel__tab-bar">
            <button
              className={`market-panel__tab ${bottomTab === 'watchlist' ? 'market-panel__tab--active' : ''}`}
              onClick={() => setBottomTab('watchlist')}
            >
              Watchlist
            </button>
            <button
              className={`market-panel__tab ${bottomTab === 'holdings' ? 'market-panel__tab--active' : ''}`}
              onClick={() => setBottomTab('holdings')}
            >
              Holdings{holdings.length > 0 ? ` (${holdings.length})` : ''}
            </button>
          </div>

          {bottomTab === 'watchlist' && (
            <>
          <div className="market-panel__add-row" ref={dropdownRef}>
            <div className="market-panel__search-wrapper">
              <input
                type="text"
                className="market-panel__add-input"
                placeholder="Search stocks..."
                value={addTicker}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                onKeyDown={(e) => e.key === 'Enter' && addTicker.trim() && handleAddTicker()}
              />
              {searchLoading && <span className="market-panel__search-spinner" />}
              <button className="market-panel__add-btn" onClick={handleAddTicker}>+</button>
              {showDropdown && (
                <div className="market-panel__dropdown">
                  {suggestions.map((s) => (
                    <button
                      key={s.symbol}
                      className="market-panel__dropdown-item"
                      onClick={() => handleSelectSuggestion(s.symbol)}
                    >
                      <span className="market-panel__dropdown-symbol">{s.symbol}</span>
                      <span className="market-panel__dropdown-name">{s.name || ''}</span>
                      <span className="market-panel__dropdown-exchange">{s.exchange || ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {addError && <span className="market-panel__add-error">{addError}</span>}

          <div className="market-panel__watchlist">
            <div className="market-panel__wl-header">
              <span className="market-panel__wl-col market-panel__wl-col--name">Stock</span>
              <span className="market-panel__wl-col market-panel__wl-col--price">Price</span>
              <span className="market-panel__wl-col market-panel__wl-col--change">Change</span>
              <span className="market-panel__wl-col market-panel__wl-col--vol">
                <span style={{ visibility: 'hidden' }}>x</span>
              </span>
            </div>

            <div className="market-panel__wl-list">
              {watchlist.map((stock) => (
                <div key={stock.ticker} className="market-panel__wl-row">
                  <div className="market-panel__wl-col market-panel__wl-col--name">
                    <span className="market-panel__wl-symbol">{stock.symbol}</span>
                    <span className="market-panel__wl-name">{stock.name}</span>
                  </div>
                  <span className="market-panel__wl-col market-panel__wl-col--price market-panel__wl-price">
                    {stock.price != null ? `₹${formatNum(stock.price)}` : '—'}
                  </span>
                  <span className={`market-panel__wl-col market-panel__wl-col--change ${stock.positive ? 'market-panel__wl-change--up' : 'market-panel__wl-change--down'}`}>
                    {stock.price != null ? `${stock.positive ? '+' : ''}${stock.change.toFixed(1)}%` : '—'}
                  </span>
                  <span className="market-panel__wl-col market-panel__wl-col--vol">
                    <button
                      className="market-panel__wl-remove"
                      title="Remove from watchlist"
                      onClick={() => handleRemoveTicker(stock.ticker)}
                    >
                      &#10005;
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
            </>
          )}

          {bottomTab === 'holdings' && (
            <div className="market-panel__holdings">
              {holdingsLoading ? (
                <div className="market-panel__loading">Loading holdings...</div>
              ) : holdings.length === 0 ? (
                <div className="market-panel__empty-holdings">
                  <span className="market-panel__empty-text">No holdings yet</span>
                  <span className="market-panel__empty-sub">Trade stocks via the AI agent to see your positions here</span>
                </div>
              ) : (
                <>
                  <div className="market-panel__holdings-summary">
                    <div className="market-panel__holdings-stat">
                      <span className="market-panel__holdings-stat-label">Invested</span>
                      <span className="market-panel__holdings-stat-value">
                        ₹{holdings.reduce((s, h) => s + (h.invested_value || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="market-panel__holdings-stat">
                      <span className="market-panel__holdings-stat-label">Current</span>
                      <span className="market-panel__holdings-stat-value">
                        ₹{holdings.reduce((s, h) => s + (h.current_value || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="market-panel__holdings-stat">
                      <span className="market-panel__holdings-stat-label">P&L</span>
                      {(() => {
                        const totalPnl = holdings.reduce((s, h) => s + (h.unrealized_pnl || 0), 0);
                        const isUp = totalPnl >= 0;
                        return (
                          <span className={`market-panel__holdings-stat-value ${isUp ? 'market-panel__pnl--up' : 'market-panel__pnl--down'}`}>
                            {isUp ? '+' : ''}₹{totalPnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="market-panel__holdings-list">
                    {holdings.map((h) => {
                      const label = h.ticker.replace('.NS', '').replace('.BO', '');
                      const isUp = (h.unrealized_pnl || 0) >= 0;
                      return (
                        <div key={h.ticker} className="market-panel__holding-row">
                          <div className="market-panel__holding-info">
                            <span className="market-panel__holding-symbol">{label}</span>
                            <span className="market-panel__holding-qty">{h.quantity} shares · Avg ₹{formatNum(h.average_price)}</span>
                          </div>
                          <div className="market-panel__holding-values">
                            <span className="market-panel__holding-price">₹{formatNum(h.current_price)}</span>
                            <span className={`market-panel__holding-pnl ${isUp ? 'market-panel__pnl--up' : 'market-panel__pnl--down'}`}>
                              {isUp ? '+' : ''}{h.unrealized_pnl_pct?.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        </div>{}

        <div className="market-panel__footer">
          <span className="market-panel__footer-text">Refreshes every 30s</span>
          <button className="market-panel__footer-btn" onClick={() => { fetchMarketData(); fetchWatchlistQuotes(); fetchHoldings(); }}>
            Refresh
          </button>
        </div>
      </aside>
    </>
  );
};

export default MarketPanel;
