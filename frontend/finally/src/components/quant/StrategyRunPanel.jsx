import { useMemo } from 'react';
import './StrategyRunPanel.css';

/* ─── Per-Category Output Renderers ─────────────────────── */

const TrendOutput = ({ output }) => {
    if (!output) return null;
    const isBull = output.direction === 'BULLISH';
    const strength = Math.min(100, (output.strength || 0) * 20);

    return (
        <div className="srp__trend-gauge">
            <span className={`srp__trend-dir ${isBull ? 'srp__trend-dir--bull' : 'srp__trend-dir--bear'}`}>
                {output.direction}
            </span>
            <div className="srp__trend-bar">
                <div
                    className="srp__trend-bar-fill"
                    style={{
                        width: `${strength}%`,
                        background: isBull
                            ? 'linear-gradient(90deg, rgba(34,197,94,0.3), #22c55e)'
                            : 'linear-gradient(90deg, rgba(239,68,68,0.3), #ef4444)',
                    }}
                />
            </div>
            <span className="srp__trend-meta">
                {output.strength?.toFixed(2)}%
            </span>
        </div>
    );
};

const MomentumOutput = ({ output }) => {
    if (!output) return null;
    const zone = output.zone || 'NEUTRAL';
    const zoneClass = zone === 'OVERBOUGHT' ? 'overbought' : zone === 'OVERSOLD' ? 'oversold' : 'neutral';

    /* Position needle based on RSI/K value (0-100 scale) */
    const value = output.rsi_value ?? output.k_value ?? 50;
    const pct = Math.min(100, Math.max(0, value));

    return (
        <div className="srp__momentum">
            <div className={`srp__momentum-zone srp__momentum-zone--${zoneClass}`}>
                {zone}
            </div>
            <div className="srp__momentum-meter">
                <div className="srp__momentum-needle" style={{ left: `${pct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: "'SF Mono', monospace" }}>
                <span>OVERSOLD</span>
                <span>{value?.toFixed(1)}</span>
                <span>OVERBOUGHT</span>
            </div>
        </div>
    );
};

const MeanReversionOutput = ({ output }) => {
    if (!output) return null;
    const dist = output.distance_from_mean || 0;
    const pct = Math.min(100, Math.max(0, (dist + 1) * 50)); /* -1 to 1 → 0% to 100% */
    const color = dist > 0.5 ? '#ef4444' : dist < -0.5 ? '#22c55e' : '#0466C8';

    return (
        <div className="srp__reversion">
            <div className="srp__reversion-label">Distance from Mean</div>
            <div className="srp__reversion-dist" style={{ color }}>
                {(dist * 100).toFixed(1)}%
            </div>
            <div className="srp__reversion-band">
                <div className="srp__reversion-pos" style={{ left: `${pct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: "'SF Mono', monospace", marginTop: '0.25rem' }}>
                <span>LOWER</span>
                <span>BW: {output.bandwidth_pct?.toFixed(1)}%</span>
                <span>UPPER</span>
            </div>
        </div>
    );
};

const VolatilityOutput = ({ output }) => {
    if (!output) return null;
    const regime = output.regime || 'NORMAL';
    const regimeClass = regime === 'HIGH' ? 'high' : regime === 'LOW' ? 'low' : 'normal';

    return (
        <div className="srp__vol">
            <div className={`srp__vol-regime srp__vol-regime--${regimeClass}`}>
                {regime} VOLATILITY
            </div>
            <div className="srp__vol-stats">
                <span>ATR: {output.current_atr?.toFixed(2)}</span>
                <span>Median: {output.median_atr?.toFixed(2)}</span>
                <span>Breakout: {((output.breakout_prob || 0) * 100).toFixed(0)}%</span>
                <span>Ratio: {output.median_atr ? (output.current_atr / output.median_atr).toFixed(2) : '--'}x</span>
            </div>
        </div>
    );
};

const MLOutput = ({ output }) => {
    if (!output) return null;
    const pred = output.prediction || 'FLAT';
    const predClass = pred === 'LONG' ? 'long' : pred === 'SHORT' ? 'short' : 'flat';
    const conf = Math.min(100, Math.max(0, (output.confidence_score || 0) * 10));

    return (
        <div className="srp__ml">
            <div className={`srp__ml-prediction srp__ml-prediction--${predClass}`}>
                {pred}
            </div>
            <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.2rem', fontFamily: "'SF Mono', monospace" }}>
                Confidence: {conf.toFixed(1)}%
            </div>
            <div className="srp__ml-conf-bar">
                <div className="srp__ml-conf-fill" style={{ width: `${conf}%` }} />
            </div>
            {output.features && (
                <div className="srp__ml-features">
                    {Object.entries(output.features).map(([k, v]) => (
                        <span key={k} className="srp__ml-feat">{k}: {(v * 100).toFixed(0)}%</span>
                    ))}
                </div>
            )}
        </div>
    );
};

const StatisticalOutput = ({ output }) => {
    if (!output) return null;
    return (
        <div className="srp__stat">
            <div className="srp__stat-state">{output.filter_state || 'N/A'}</div>
            <div className="srp__stat-meta">
                Est. Price: {output.estimated_price?.toFixed(2)}<br />
                Velocity: {output.velocity?.toFixed(6)}<br />
                Gain: {output.gain?.toFixed(2)}
            </div>
        </div>
    );
};

const GenericOutput = ({ output }) => {
    if (!output) return null;
    const dir = output.net_direction || 'N/A';
    const color = dir === 'BULLISH' ? '#22c55e' : '#ef4444';
    return (
        <div className="srp__stat">
            <div className="srp__stat-state" style={{ color }}>{dir}</div>
            <div className="srp__stat-meta">
                Total Signals: {output.total_signals || 0}
            </div>
        </div>
    );
};

const OUTPUT_RENDERER = {
    trend: TrendOutput,
    momentum: MomentumOutput,
    mean_reversion: MeanReversionOutput,
    volatility: VolatilityOutput,
    ml: MLOutput,
    statistical: StatisticalOutput,
    generic: GenericOutput,
};

/* ═══════════════════════════════════════════════════════════ */

const StrategyRunPanel = ({ steps, progress, isRunning, finalResult, error, onBack }) => {
    const completedSteps = useMemo(() => {
        return steps.filter(s => !s.final);
    }, [steps]);

    const OutputComponent = finalResult?.output_type
        ? OUTPUT_RENDERER[finalResult.output_type] || GenericOutput
        : null;

    return (
        <div className="srp">
            {/* Header */}
            <div className="srp__header">
                <span className="srp__title">
                    {isRunning ? 'Executing Strategy' : finalResult ? 'Execution Complete' : 'Strategy Runner'}
                </span>
                <button className="srp__back-btn" onClick={onBack}>
                    {finalResult ? 'New Run' : 'Cancel'}
                </button>
            </div>

            {/* Progress Bar */}
            <div className="srp__progress-wrap">
                <div className="srp__progress-bar">
                    <div className="srp__progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="srp__progress-label">
                    <span>{isRunning ? 'Processing...' : finalResult ? 'Done' : 'Ready'}</span>
                    <span>{progress}%</span>
                </div>
            </div>

            {/* Steps Log */}
            <div className="srp__steps">
                {completedSteps.map((step, idx) => {
                    const isDone = step.step < (steps[steps.length - 1]?.step || 0) || finalResult;
                    const isActive = !isDone && isRunning;

                    return (
                        <div className="srp__step" key={idx}>
                            <div className={`srp__step-icon ${isDone ? 'srp__step-icon--done' : isActive ? 'srp__step-icon--active' : ''}`}>
                                {isDone ? 'OK' : isActive ? '..' : step.step}
                            </div>
                            <div className="srp__step-body">
                                <div className="srp__step-title">{step.title}</div>
                                <div className="srp__step-detail">{step.detail}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Error */}
            {error && <div className="srp__error">{error}</div>}

            {/* Final Output */}
            {finalResult && OutputComponent && (
                <div className="srp__output">
                    <div className="srp__output-title">Strategy Output</div>
                    <OutputComponent output={finalResult.output} />
                </div>
            )}

            {/* Metrics */}
            {finalResult?.metrics && (
                <div className="srp__metrics">
                    <div className="srp__metric">
                        <div className="srp__metric-label">Sharpe</div>
                        <div className="srp__metric-value">{finalResult.metrics.sharpe_ratio?.toFixed(2)}</div>
                    </div>
                    <div className="srp__metric">
                        <div className="srp__metric-label">Win Rate</div>
                        <div className="srp__metric-value">{(finalResult.metrics.win_rate * 100)?.toFixed(0)}%</div>
                    </div>
                    <div className="srp__metric">
                        <div className="srp__metric-label">Trades</div>
                        <div className="srp__metric-value">{finalResult.metrics.total_trades}</div>
                    </div>
                    <div className="srp__metric">
                        <div className="srp__metric-label">P/F Ratio</div>
                        <div className="srp__metric-value">{finalResult.metrics.profit_factor?.toFixed(2)}</div>
                    </div>
                    <div className="srp__metric">
                        <div className="srp__metric-label">Max DD</div>
                        <div className="srp__metric-value">{finalResult.metrics.max_drawdown?.toFixed(1)}%</div>
                    </div>
                    <div className="srp__metric">
                        <div className="srp__metric-label">Risk</div>
                        <div className="srp__metric-value">{finalResult.metrics.risk_level}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrategyRunPanel;
