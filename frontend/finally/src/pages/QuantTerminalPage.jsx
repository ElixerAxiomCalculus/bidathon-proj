import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QuantInstrumentPanel from '../components/quant/QuantInstrumentPanel';
import QuantChartPanel from '../components/quant/QuantChartPanel';
import QuantStrategyLab from '../components/quant/QuantStrategyLab';
import {
    getStockQuote,
    getStockHistory,
    getQuantStrategies,
    runQuantStrategy,
    runQuantBacktest,
    getQuantInsight,
    createQuantWebSocket,
    streamQuantStrategy,
} from '../services/api';
import './QuantTerminalPage.css';

const TIMEFRAMES = [
    { label: '1m', period: '1d', interval: '1m' },
    { label: '5m', period: '5d', interval: '5m' },
    { label: '15m', period: '5d', interval: '15m' },
    { label: '1H', period: '1mo', interval: '60m' },
    { label: '1D', period: '6mo', interval: '1d' },
    { label: '1W', period: '2y', interval: '1wk' },
];

const CHART_TYPES = ['Candlestick', 'OHLC', 'Heikin Ashi'];

const QuantTerminalPage = () => {
    const navigate = useNavigate();
    const wsRef = useRef(null);
    const pollRef = useRef(null);
    const streamCloseRef = useRef(null);

    const [ticker, setTicker] = useState('AAPL');
    const [quote, setQuote] = useState(null);
    const [history, setHistory] = useState([]);
    const [strategies, setStrategies] = useState([]);
    const [activeTimeframe, setActiveTimeframe] = useState(4);
    const [chartType, setChartType] = useState('Candlestick');
    const [wsConnected, setWsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);

    /* Strategy execution state */
    const [strategyResult, setStrategyResult] = useState(null);
    const [backtestResult, setBacktestResult] = useState(null);
    const [insight, setInsight] = useState(null);
    const [loading, setLoading] = useState({
        chart: false, strategy: false, backtest: false, insight: false,
    });

    /* ─── NEW: Streaming strategy state ─── */
    const [streamState, setStreamState] = useState({
        isRunning: false,
        steps: [],
        progress: 0,
        finalResult: null,
        error: null,
    });

    /* ─── NEW: Streaming signals/indicators for live chart overlay ─── */
    const [streamSignals, setStreamSignals] = useState([]);
    const [streamIndicators, setStreamIndicators] = useState({});

    /* Load strategies list on mount */
    useEffect(() => {
        getQuantStrategies()
            .then((data) => setStrategies(data.strategies || []))
            .catch(() => { });
    }, []);

    /* Load chart data */
    const loadChartData = useCallback(async (sym, tfIndex) => {
        const tf = TIMEFRAMES[tfIndex];
        setLoading((p) => ({ ...p, chart: true }));
        try {
            const [quoteData, histData] = await Promise.all([
                getStockQuote(sym),
                getStockHistory(sym, tf.period, tf.interval),
            ]);
            setQuote(quoteData);
            setHistory(histData || []);
            setLastUpdate(new Date().toLocaleTimeString());
        } catch (e) {
            console.error('Chart load failed:', e);
        } finally {
            setLoading((p) => ({ ...p, chart: false }));
        }
    }, []);

    /* Initial load + on ticker/timeframe change */
    useEffect(() => {
        loadChartData(ticker, activeTimeframe);
    }, [ticker, activeTimeframe, loadChartData]);

    /* ─── NEW: 1-second real-time chart polling ─── */
    useEffect(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }

        const tf = TIMEFRAMES[activeTimeframe];

        pollRef.current = setInterval(async () => {
            try {
                const [quoteData, histData] = await Promise.all([
                    getStockQuote(ticker),
                    getStockHistory(ticker, tf.period, tf.interval),
                ]);
                setQuote(quoteData);
                if (histData && histData.length > 0) {
                    setHistory(histData);
                }
                setLastUpdate(new Date().toLocaleTimeString());
            } catch {
                /* Silent fail — data stays at previous state */
            }
        }, 1000);

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [ticker, activeTimeframe]);

    /* WebSocket live updates */
    useEffect(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        const timer = setTimeout(() => {
            try {
                const ws = createQuantWebSocket(ticker);
                wsRef.current = ws;

                ws.onopen = () => setWsConnected(true);
                ws.onclose = () => setWsConnected(false);
                ws.onerror = () => {
                    setWsConnected(false);
                };
                ws.onmessage = (e) => {
                    try {
                        const data = JSON.parse(e.data);
                        if (data.price && !data.error) {
                            setQuote((prev) => prev ? { ...prev, ...data } : data);
                            setLastUpdate(new Date().toLocaleTimeString());
                        }
                    } catch { }
                };
            } catch {
                setWsConnected(false);
            }
        }, 2000);

        return () => {
            clearTimeout(timer);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [ticker]);

    /* Select instrument */
    const handleSelectTicker = useCallback((sym) => {
        setTicker(sym.toUpperCase());
        setStrategyResult(null);
        setBacktestResult(null);
        setInsight(null);
        setStreamState({ isRunning: false, steps: [], progress: 0, finalResult: null, error: null });
        setStreamSignals([]);
        setStreamIndicators({});
    }, []);

    /* ─── NEW: Stream strategy execution ─── */
    const handleStreamRun = useCallback((strategyKey) => {
        /* Abort any previous stream */
        if (streamCloseRef.current) {
            streamCloseRef.current();
            streamCloseRef.current = null;
        }

        const tf = TIMEFRAMES[activeTimeframe];

        /* Reset state */
        setStreamState({ isRunning: true, steps: [], progress: 0, finalResult: null, error: null });
        setStreamSignals([]);
        setStreamIndicators({});
        setStrategyResult(null);
        setInsight(null);

        const close = streamQuantStrategy(
            ticker,
            strategyKey,
            tf.period,
            tf.interval,
            {},
            /* onStep */
            (step) => {
                setStreamState((prev) => ({
                    ...prev,
                    steps: [...prev.steps, step],
                    progress: step.progress || prev.progress,
                }));

                /* Progressively overlay indicators on chart */
                if (step.indicator) {
                    setStreamIndicators((prev) => ({ ...prev, ...step.indicator }));
                }

                /* Progressively add signals to chart */
                if (step.signals) {
                    setStreamSignals(step.signals);
                }
            },
            /* onComplete */
            (result) => {
                setStreamState((prev) => ({
                    ...prev,
                    isRunning: false,
                    progress: 100,
                    finalResult: result,
                    steps: [...prev.steps, result],
                }));

                /* Set final signals + indicators on chart */
                if (result.signals) setStreamSignals(result.signals);
                if (result.indicator_data) setStreamIndicators(result.indicator_data);

                /* Also set strategyResult for the existing metrics/signals panels */
                setStrategyResult({
                    ticker: ticker,
                    strategy: strategyKey,
                    signals: result.signals || [],
                    metrics: result.metrics || {},
                    indicator_data: result.indicator_data || {},
                });
            },
            /* onError */
            (err) => {
                setStreamState((prev) => ({
                    ...prev,
                    isRunning: false,
                    error: err,
                }));
            }
        );

        streamCloseRef.current = close;
    }, [ticker, activeTimeframe]);

    /* Reset streaming state */
    const handleStreamReset = useCallback(() => {
        if (streamCloseRef.current) {
            streamCloseRef.current();
            streamCloseRef.current = null;
        }
        setStreamState({ isRunning: false, steps: [], progress: 0, finalResult: null, error: null });
        setStreamSignals([]);
        setStreamIndicators({});
    }, []);

    /* Run strategy (non-streaming fallback) */
    const handleRunStrategy = useCallback(async (strategyKey, params = {}) => {
        const tf = TIMEFRAMES[activeTimeframe];
        setLoading((p) => ({ ...p, strategy: true }));
        setStrategyResult(null);
        setInsight(null);
        try {
            const result = await runQuantStrategy(ticker, strategyKey, tf.period, tf.interval, params);
            setStrategyResult(result);
        } catch (e) {
            console.error('Strategy run failed:', e);
        } finally {
            setLoading((p) => ({ ...p, strategy: false }));
        }
    }, [ticker, activeTimeframe]);

    /* Run backtest */
    const handleRunBacktest = useCallback(async (strategyKey, params = {}, initialCapital = 100000) => {
        setLoading((p) => ({ ...p, backtest: true }));
        setBacktestResult(null);
        try {
            const result = await runQuantBacktest(ticker, strategyKey, '1y', '1d', initialCapital, params);
            setBacktestResult(result);
        } catch (e) {
            console.error('Backtest failed:', e);
        } finally {
            setLoading((p) => ({ ...p, backtest: false }));
        }
    }, [ticker]);

    /* Generate AI insight */
    const handleGetInsight = useCallback(async () => {
        if (!strategyResult) return;
        setLoading((p) => ({ ...p, insight: true }));
        try {
            const result = await getQuantInsight(
                ticker,
                strategyResult.strategy,
                strategyResult.metrics,
                { total_signals: strategyResult.signals?.length || 0 }
            );
            setInsight(result);
        } catch (e) {
            console.error('Insight failed:', e);
        } finally {
            setLoading((p) => ({ ...p, insight: false }));
        }
    }, [ticker, strategyResult]);

    const priceChange = quote?.change ?? (quote?.price && quote?.previous_close
        ? (quote.price - quote.previous_close) : 0);
    const priceChangePct = quote?.change_pct ?? (quote?.price && quote?.previous_close
        ? ((quote.price - quote.previous_close) / quote.previous_close * 100) : 0);
    const isPositive = priceChange >= 0;

    /* Determine what signals/indicators to show on chart */
    const chartSignals = streamSignals.length > 0 ? streamSignals : (strategyResult?.signals || []);
    const chartIndicators = Object.keys(streamIndicators).length > 0 ? streamIndicators : (strategyResult?.indicator_data || {});

    return (
        <div className="qt-page">
            {/* ─── Top Bar ─────────────────────────────────────── */}
            <header className="qt-topbar">
                <a className="qt-topbar__brand" onClick={() => navigate('/dashboard')}>
                    Fin<span>Ally</span> TERMINAL
                </a>

                <div className="qt-topbar__divider" />

                {quote && (
                    <div className="qt-topbar__ticker">
                        <span className="qt-topbar__ticker-symbol">{ticker}</span>
                        <span
                            className="qt-topbar__ticker-price"
                            style={{ color: isPositive ? 'var(--qt-green)' : 'var(--qt-red)' }}
                        >
                            {quote.price?.toFixed(2)}
                        </span>
                        <span className={`qt-topbar__ticker-change ${isPositive ? 'qt-topbar__ticker-change--up' : 'qt-topbar__ticker-change--down'}`}>
                            {isPositive ? '+' : ''}{priceChange?.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePct?.toFixed(2)}%)
                        </span>
                    </div>
                )}

                <div className="qt-topbar__divider" />

                <div className="qt-topbar__timeframes">
                    {TIMEFRAMES.map((tf, idx) => (
                        <button
                            key={tf.label}
                            className={`qt-topbar__tf-btn ${idx === activeTimeframe ? 'qt-topbar__tf-btn--active' : ''}`}
                            onClick={() => setActiveTimeframe(idx)}
                        >
                            {tf.label}
                        </button>
                    ))}
                </div>

                <div className="qt-topbar__chart-types">
                    {CHART_TYPES.map((ct) => (
                        <button
                            key={ct}
                            className={`qt-topbar__ct-btn ${ct === chartType ? 'qt-topbar__ct-btn--active' : ''}`}
                            onClick={() => setChartType(ct)}
                        >
                            {ct}
                        </button>
                    ))}
                </div>

                <div className="qt-topbar__spacer" />

                <div className="qt-topbar__status">
                    <span className={`qt-topbar__status-dot ${wsConnected ? '' : 'qt-topbar__status-dot--disconnected'}`} />
                    <span>{wsConnected ? 'LIVE' : 'OFFLINE'}</span>
                </div>

                <button className="qt-topbar__back-btn" onClick={() => navigate('/dashboard')}>
                    Dashboard
                </button>
            </header>

            {/* ─── Three-Panel Body ────────────────────────────── */}
            <div className="qt-body">
                <div className="qt-panel-left">
                    <QuantInstrumentPanel
                        activeTicker={ticker}
                        onSelectTicker={handleSelectTicker}
                        quote={quote}
                    />
                </div>

                <div className="qt-panel-center">
                    <QuantChartPanel
                        ticker={ticker}
                        history={history}
                        chartType={chartType}
                        signals={chartSignals}
                        indicatorData={chartIndicators}
                        loading={loading.chart}
                    />
                </div>

                <div className="qt-panel-right">
                    <QuantStrategyLab
                        ticker={ticker}
                        strategies={strategies}
                        strategyResult={strategyResult}
                        backtestResult={backtestResult}
                        insight={insight}
                        loading={loading}
                        onRunStrategy={handleRunStrategy}
                        onRunBacktest={handleRunBacktest}
                        onGetInsight={handleGetInsight}
                        streamState={streamState}
                        onStreamRun={handleStreamRun}
                        onStreamReset={handleStreamReset}
                    />
                </div>
            </div>

            {/* ─── Status Bar ─────────────────────────────────── */}
            <footer className="qt-statusbar">
                <div className="qt-statusbar__item">
                    <span className="qt-statusbar__label">SRC</span>
                    <span className="qt-statusbar__value">YFINANCE</span>
                </div>
                <div className="qt-statusbar__item">
                    <span className="qt-statusbar__label">UPD</span>
                    <span className="qt-statusbar__value">{lastUpdate || '--:--:--'}</span>
                </div>
                <div className="qt-statusbar__item">
                    <span className="qt-statusbar__label">TF</span>
                    <span className="qt-statusbar__value">{TIMEFRAMES[activeTimeframe].label}</span>
                </div>
                <div className="qt-statusbar__item">
                    <span className="qt-statusbar__label">BARS</span>
                    <span className="qt-statusbar__value">{history.length}</span>
                </div>
                {streamState.isRunning && (
                    <div className="qt-statusbar__item">
                        <span className="qt-statusbar__label">ALGO</span>
                        <span className="qt-statusbar__value" style={{ color: '#0466C8' }}>RUNNING {streamState.progress}%</span>
                    </div>
                )}
                {strategyResult && !streamState.isRunning && (
                    <div className="qt-statusbar__item">
                        <span className="qt-statusbar__label">SIG</span>
                        <span className="qt-statusbar__value">{strategyResult.signals?.length || 0}</span>
                    </div>
                )}
                <div className="qt-statusbar__spacer" />
                <span className="qt-statusbar__disclaimer">
                    Algorithmic output only. Not financial advice. All trading involves risk.
                </span>
            </footer>
        </div>
    );
};

export default QuantTerminalPage;
