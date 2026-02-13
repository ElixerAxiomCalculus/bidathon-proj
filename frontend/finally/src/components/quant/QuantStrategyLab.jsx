import { useState, useMemo } from 'react';
import StrategyRunPanel from './StrategyRunPanel';
import './QuantStrategyLab.css';

const fmt = (n, dec = 2) => {
    if (n == null || isNaN(n)) return '--';
    return Number(n).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

const fmtDate = (d) => {
    if (!d) return '';
    const str = String(d);
    return str.length > 10 ? str.slice(0, 10) : str;
};

const QuantStrategyLab = ({
    ticker,
    strategies,
    strategyResult,
    backtestResult,
    insight,
    loading,
    onRunStrategy,
    onRunBacktest,
    onGetInsight,
    /* ─── NEW: streaming props ─── */
    streamState,     /* { isRunning, steps, progress, finalResult, error } */
    onStreamRun,     /* (strategyKey) => start streaming */
    onStreamReset,   /* () => reset to strategy selector */
}) => {
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [openSections, setOpenSections] = useState({
        strategies: true, metrics: true, signals: true, backtest: true, insight: true,
    });

    const toggleSection = (key) =>
        setOpenSections((p) => ({ ...p, [key]: !p[key] }));

    /* Group strategies by category */
    const grouped = useMemo(() => {
        const map = {};
        (strategies || []).forEach((s) => {
            const cat = s.category || 'Other';
            if (!map[cat]) map[cat] = [];
            map[cat].push(s);
        });
        return map;
    }, [strategies]);

    const metrics = strategyResult?.metrics;

    /* Equity curve SVG — must be above any conditional return to satisfy hooks rules */
    const equitySvg = useMemo(() => {
        if (!backtestResult?.equity_curve || backtestResult.equity_curve.length < 2) return null;
        const data = backtestResult.equity_curve;
        const values = data.map((d) => d.value);
        const minV = Math.min(...values);
        const maxV = Math.max(...values);
        const range = maxV - minV || 1;
        const w = 300;
        const h = 90;
        const pad = 4;
        const points = values.map((v, i) => {
            const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
            const y = pad + (1 - (v - minV) / range) * (h - 2 * pad);
            return `${x},${y}`;
        });
        const isProfit = values[values.length - 1] >= values[0];
        const color = isProfit ? '#22c55e' : '#ef4444';
        const linePath = `M${points.join(' L')}`;
        const fillPath = `${linePath} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
        return { linePath, fillPath, color, w, h };
    }, [backtestResult]);

    const handleSelectStrategy = (key) => {
        setSelectedStrategy(key);
    };

    const handleRun = () => {
        if (selectedStrategy && onStreamRun) {
            onStreamRun(selectedStrategy);
        }
    };

    const handleBacktest = () => {
        if (selectedStrategy) onRunBacktest(selectedStrategy);
    };

    const handleBack = () => {
        if (onStreamReset) onStreamReset();
    };

    /* If streaming is active or has a result, show the RunPanel */
    if (streamState && (streamState.isRunning || streamState.finalResult || streamState.error)) {
        return (
            <>
                <div className="qt-panel-header">STRATEGY LAB</div>
                <div className="qt-panel-body" style={{ padding: 0 }}>
                    <StrategyRunPanel
                        steps={streamState.steps || []}
                        progress={streamState.progress || 0}
                        isRunning={streamState.isRunning}
                        finalResult={streamState.finalResult}
                        error={streamState.error}
                        onBack={handleBack}
                    />
                </div>
            </>
        );
    }

    return (
        <>
            <div className="qt-panel-header">STRATEGY LAB</div>

            <div className="qt-panel-body">
                {/* ─── Strategy Selector ──────────────────────── */}
                <div className="qs-section">
                    <div className="qs-section__header" onClick={() => toggleSection('strategies')}>
                        <span className="qs-section__title">Algorithms</span>
                        <span className="qs-section__toggle">{openSections.strategies ? '[-]' : '[+]'}</span>
                    </div>
                    {openSections.strategies && (
                        <div className="qs-section__body">
                            {Object.entries(grouped).map(([cat, strats]) => (
                                <div key={cat}>
                                    <div className="qs-cat-label">{cat}</div>
                                    {strats.map((s) => (
                                        <button
                                            key={s.key}
                                            className={`qs-strat-btn ${selectedStrategy === s.key ? 'qs-strat-btn--active' : ''}`}
                                            onClick={() => handleSelectStrategy(s.key)}
                                        >
                                            <div>{s.name}</div>
                                            <div className="qs-strat-desc">{s.description}</div>
                                        </button>
                                    ))}
                                </div>
                            ))}

                            {strategies.length === 0 && (
                                <div className="qs-loading">Loading strategies...</div>
                            )}

                            <div className="qs-controls">
                                <button
                                    className="qs-btn qs-btn--primary"
                                    disabled={!selectedStrategy || loading.strategy}
                                    onClick={handleRun}
                                >
                                    {loading.strategy ? <><span className="qs-spinner" />Executing...</> : 'Run Strategy'}
                                </button>
                                <button
                                    className="qs-btn qs-btn--secondary"
                                    disabled={!selectedStrategy || loading.backtest}
                                    onClick={handleBacktest}
                                >
                                    {loading.backtest ? <><span className="qs-spinner" />Running...</> : 'Backtest'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ─── Metrics Panel ─────────────────────────── */}
                {metrics && (
                    <div className="qs-section">
                        <div className="qs-section__header" onClick={() => toggleSection('metrics')}>
                            <span className="qs-section__title">Performance Metrics</span>
                            <span className="qs-section__toggle">{openSections.metrics ? '[-]' : '[+]'}</span>
                        </div>
                        {openSections.metrics && (
                            <div className="qs-section__body">
                                <div className="qs-metrics">
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Sharpe Ratio</div>
                                        <div className="qs-metric__value" style={{ color: metrics.sharpe_ratio > 1 ? 'var(--qt-green)' : metrics.sharpe_ratio > 0 ? 'var(--qt-yellow)' : 'var(--qt-red)' }}>
                                            {fmt(metrics.sharpe_ratio, 3)}
                                        </div>
                                    </div>
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Win Rate</div>
                                        <div className="qs-metric__value">{fmt(metrics.win_rate * 100, 1)}%</div>
                                    </div>
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Max Drawdown</div>
                                        <div className="qs-metric__value" style={{ color: 'var(--qt-red)' }}>
                                            -{fmt(metrics.max_drawdown, 1)}%
                                        </div>
                                    </div>
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Total Trades</div>
                                        <div className="qs-metric__value">{metrics.total_trades}</div>
                                    </div>
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Profit Factor</div>
                                        <div className="qs-metric__value">{fmt(metrics.profit_factor, 2)}</div>
                                    </div>
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Risk</div>
                                        <div className="qs-metric__value">
                                            <span className={`qs-risk qs-risk--${metrics.risk_level?.toLowerCase()}`}>
                                                {metrics.risk_level}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Avg Win</div>
                                        <div className="qs-metric__value" style={{ color: 'var(--qt-green)' }}>{fmt(metrics.avg_win)}</div>
                                    </div>
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Avg Loss</div>
                                        <div className="qs-metric__value" style={{ color: 'var(--qt-red)' }}>{fmt(metrics.avg_loss)}</div>
                                    </div>
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Confidence</div>
                                        <div className="qs-metric__value">{fmt(metrics.confidence * 100, 0)}%</div>
                                    </div>
                                    <div className="qs-metric">
                                        <div className="qs-metric__label">Position Size</div>
                                        <div className="qs-metric__value">{fmt(metrics.suggested_position_pct, 0)}%</div>
                                    </div>
                                </div>

                                {metrics.verdict && (
                                    <div className="qs-verdict">
                                        <div className="qs-verdict__label">Verdict</div>
                                        {metrics.verdict}
                                    </div>
                                )}

                                <div className="qs-controls" style={{ marginTop: 8 }}>
                                    <button
                                        className="qs-btn qs-btn--insight"
                                        disabled={loading.insight}
                                        onClick={onGetInsight}
                                    >
                                        {loading.insight ? <><span className="qs-spinner" />Generating...</> : 'Generate AI Insight'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── AI Insight ────────────────────────────── */}
                {insight && (
                    <div className="qs-section">
                        <div className="qs-section__header" onClick={() => toggleSection('insight')}>
                            <span className="qs-section__title">AI Research Note</span>
                            <span className="qs-section__toggle">{openSections.insight ? '[-]' : '[+]'}</span>
                        </div>
                        {openSections.insight && (
                            <div className="qs-section__body">
                                <div className="qs-insight">
                                    <div className="qs-insight__label">Institutional Analysis</div>
                                    <div className="qs-insight__text">{insight.insight}</div>
                                    <div className="qs-insight__disclaimer">{insight.disclaimer}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Signals Log ───────────────────────────── */}
                {strategyResult?.signals?.length > 0 && (
                    <div className="qs-section">
                        <div className="qs-section__header" onClick={() => toggleSection('signals')}>
                            <span className="qs-section__title">Signal Log ({strategyResult.signals.length})</span>
                            <span className="qs-section__toggle">{openSections.signals ? '[-]' : '[+]'}</span>
                        </div>
                        {openSections.signals && (
                            <div className="qs-section__body">
                                <div className="qs-signals">
                                    {strategyResult.signals.map((s, i) => (
                                        <div key={i} className="qs-signal-row">
                                            <span className="qs-signal-date">{fmtDate(s.date)}</span>
                                            <span className={`qs-signal-type ${s.type === 'BUY' ? 'qs-signal-type--buy' : 'qs-signal-type--sell'}`}>
                                                {s.type}
                                            </span>
                                            <span className="qs-signal-price">{fmt(s.price)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Backtest Results ──────────────────────── */}
                {backtestResult && (
                    <div className="qs-section">
                        <div className="qs-section__header" onClick={() => toggleSection('backtest')}>
                            <span className="qs-section__title">Backtest Results</span>
                            <span className="qs-section__toggle">{openSections.backtest ? '[-]' : '[+]'}</span>
                        </div>
                        {openSections.backtest && (
                            <div className="qs-section__body">
                                <div className="qs-bt-summary">
                                    <div>
                                        <div className="qs-bt-label">Initial Capital</div>
                                        <div className="qs-bt-value" style={{ color: 'var(--qt-text)' }}>
                                            ${fmt(backtestResult.initial_capital, 0)}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div className="qs-bt-label">Return</div>
                                        <div className="qs-bt-value" style={{ color: backtestResult.total_return_pct >= 0 ? 'var(--qt-green)' : 'var(--qt-red)' }}>
                                            {backtestResult.total_return_pct >= 0 ? '+' : ''}{fmt(backtestResult.total_return_pct, 1)}%
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="qs-bt-label">Final Value</div>
                                        <div className="qs-bt-value" style={{ color: backtestResult.final_value >= backtestResult.initial_capital ? 'var(--qt-green)' : 'var(--qt-red)' }}>
                                            ${fmt(backtestResult.final_value, 0)}
                                        </div>
                                    </div>
                                </div>

                                {equitySvg && (
                                    <div className="qs-equity-chart">
                                        <svg className="qs-equity-svg" viewBox={`0 0 ${equitySvg.w} ${equitySvg.h}`} preserveAspectRatio="none">
                                            <path className="qs-equity-fill" d={equitySvg.fillPath} fill={equitySvg.color} />
                                            <path className="qs-equity-path" d={equitySvg.linePath} stroke={equitySvg.color} />
                                        </svg>
                                    </div>
                                )}

                                {backtestResult.metrics && (
                                    <div className="qs-metrics" style={{ marginTop: 8 }}>
                                        <div className="qs-metric">
                                            <div className="qs-metric__label">Sharpe</div>
                                            <div className="qs-metric__value">{fmt(backtestResult.metrics.sharpe_ratio, 3)}</div>
                                        </div>
                                        <div className="qs-metric">
                                            <div className="qs-metric__label">Max DD</div>
                                            <div className="qs-metric__value" style={{ color: 'var(--qt-red)' }}>-{fmt(backtestResult.metrics.max_drawdown, 1)}%</div>
                                        </div>
                                        <div className="qs-metric">
                                            <div className="qs-metric__label">Win Rate</div>
                                            <div className="qs-metric__value">{fmt(backtestResult.metrics.win_rate * 100, 1)}%</div>
                                        </div>
                                        <div className="qs-metric">
                                            <div className="qs-metric__label">Trades</div>
                                            <div className="qs-metric__value">{backtestResult.metrics.total_trades}</div>
                                        </div>
                                    </div>
                                )}

                                {backtestResult.trade_log?.length > 0 && (
                                    <>
                                        <div className="qs-cat-label" style={{ marginTop: 10 }}>Trade Log</div>
                                        <div className="qs-trades">
                                            {backtestResult.trade_log.map((t, i) => (
                                                <div key={i} className="qs-trade-row">
                                                    <span className="qs-trade-date">{fmtDate(t.date)}</span>
                                                    <span
                                                        className="qs-trade-type"
                                                        style={{ color: t.type === 'BUY' ? 'var(--qt-green)' : 'var(--qt-red)' }}
                                                    >
                                                        {t.type}
                                                    </span>
                                                    <span
                                                        className="qs-trade-pnl"
                                                        style={{
                                                            color: t.pnl > 0 ? 'var(--qt-green)' : t.pnl < 0 ? 'var(--qt-red)' : 'var(--qt-text-dim)',
                                                        }}
                                                    >
                                                        {t.pnl !== 0 ? (t.pnl > 0 ? '+' : '') + fmt(t.pnl) : '--'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Empty State ───────────────────────────── */}
                {!metrics && !backtestResult && (
                    <div className="qs-loading" style={{ padding: '40px 20px' }}>
                        Select a strategy and click "Run Strategy" to analyze {ticker} with quantitative algorithms.
                    </div>
                )}
            </div>
        </>
    );
};

export default QuantStrategyLab;
