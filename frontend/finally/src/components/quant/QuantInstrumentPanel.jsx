import { useState, useEffect, useCallback, useRef } from 'react';
import { searchStocks, getMarketOverview } from '../../services/api';
import './QuantInstrumentPanel.css';

const POPULAR = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'WMT'];

const fmt = (n, dec = 2) => {
    if (n == null) return '--';
    return typeof n === 'number' ? n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) : n;
};

const QuantInstrumentPanel = ({ activeTicker, onSelectTicker, quote }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [marketData, setMarketData] = useState([]);
    const debounceRef = useRef(null);

    useEffect(() => {
        getMarketOverview()
            .then((data) => setMarketData(Array.isArray(data) ? data : []))
            .catch(() => { });
    }, []);

    const doSearch = useCallback(async (q) => {
        if (!q || q.length < 1) {
            setResults([]);
            return;
        }
        setSearching(true);
        try {
            const data = await searchStocks(q);
            setResults(Array.isArray(data) ? data.slice(0, 10) : []);
        } catch {
            setResults([]);
        } finally {
            setSearching(false);
        }
    }, []);

    const handleInput = (e) => {
        const v = e.target.value;
        setQuery(v);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(v), 300);
    };

    const handleSelect = (sym) => {
        onSelectTicker(sym);
        setQuery('');
        setResults([]);
    };

    const change = quote?.price && quote?.previous_close
        ? quote.price - quote.previous_close : 0;
    const changePct = quote?.previous_close
        ? (change / quote.previous_close * 100) : 0;
    const isUp = change >= 0;

    return (
        <>
            <div className="qt-panel-header">INSTRUMENTS</div>

            <div className="qi-search">
                <input
                    className="qi-search__input"
                    type="text"
                    placeholder="Search ticker or company..."
                    value={query}
                    onChange={handleInput}
                    spellCheck={false}
                />
            </div>

            {results.length > 0 && (
                <div className="qi-results">
                    {results.map((r) => (
                        <div
                            key={r.symbol}
                            className={`qi-result-item ${r.symbol === activeTicker ? 'qi-result-item--active' : ''}`}
                            onClick={() => handleSelect(r.symbol)}
                        >
                            <div>
                                <span className="qi-result-symbol">{r.symbol}</span>
                                <span className="qi-result-name">{r.name}</span>
                            </div>
                            <span className="qi-result-exchange">{r.exchange}</span>
                        </div>
                    ))}
                </div>
            )}

            {quote && (
                <div className="qi-quote">
                    <div className="qi-quote__header">
                        <span className="qi-quote__ticker">{activeTicker}</span>
                        <span className="qi-quote__price" style={{ color: isUp ? 'var(--qt-green)' : 'var(--qt-red)' }}>
                            {fmt(quote.price)}
                        </span>
                    </div>
                    <div className="qi-quote__name">{quote.name || activeTicker}</div>
                    <div className="qi-quote__grid">
                        <div className="qi-quote__row">
                            <span className="qi-quote__label">Open</span>
                            <span className="qi-quote__value">{fmt(quote.open)}</span>
                        </div>
                        <div className="qi-quote__row">
                            <span className="qi-quote__label">Prev Close</span>
                            <span className="qi-quote__value">{fmt(quote.previous_close)}</span>
                        </div>
                        <div className="qi-quote__row">
                            <span className="qi-quote__label">High</span>
                            <span className="qi-quote__value">{fmt(quote.day_high)}</span>
                        </div>
                        <div className="qi-quote__row">
                            <span className="qi-quote__label">Low</span>
                            <span className="qi-quote__value">{fmt(quote.day_low)}</span>
                        </div>
                        <div className="qi-quote__row">
                            <span className="qi-quote__label">Volume</span>
                            <span className="qi-quote__value">{fmt(quote.volume, 0)}</span>
                        </div>
                        <div className="qi-quote__row">
                            <span className="qi-quote__label">Mkt Cap</span>
                            <span className="qi-quote__value">
                                {quote.market_cap ? (quote.market_cap >= 1e12
                                    ? (quote.market_cap / 1e12).toFixed(2) + 'T'
                                    : quote.market_cap >= 1e9
                                        ? (quote.market_cap / 1e9).toFixed(1) + 'B'
                                        : (quote.market_cap / 1e6).toFixed(0) + 'M')
                                    : '--'}
                            </span>
                        </div>
                        <div className="qi-quote__row">
                            <span className="qi-quote__label">P/E</span>
                            <span className="qi-quote__value">{fmt(quote.pe_ratio)}</span>
                        </div>
                        <div className="qi-quote__row">
                            <span className="qi-quote__label">Change</span>
                            <span className="qi-quote__value" style={{ color: isUp ? 'var(--qt-green)' : 'var(--qt-red)' }}>
                                {isUp ? '+' : ''}{fmt(change)} ({isUp ? '+' : ''}{fmt(changePct)}%)
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <div className="qt-panel-header">POPULAR</div>
            <div className="qi-watchlist">
                {POPULAR.map((sym) => (
                    <div
                        key={sym}
                        className="qi-watchlist-item"
                        onClick={() => handleSelect(sym)}
                    >
                        <span className="qi-watchlist-sym">{sym}</span>
                    </div>
                ))}
            </div>

            {marketData.length > 0 && (
                <>
                    <div className="qt-panel-header">MARKET</div>
                    <div className="qi-watchlist">
                        {marketData.map((m) => (
                            <div
                                key={m.ticker}
                                className="qi-watchlist-item"
                                onClick={() => handleSelect(m.ticker)}
                            >
                                <span className="qi-watchlist-sym">{m.name || m.ticker}</span>
                                <span
                                    className="qi-watchlist-price"
                                    style={{ color: (m.change || 0) >= 0 ? 'var(--qt-green)' : 'var(--qt-red)' }}
                                >
                                    {fmt(m.price)}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </>
    );
};

export default QuantInstrumentPanel;
