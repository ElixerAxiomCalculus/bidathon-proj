import { useEffect, useRef, useMemo } from 'react';
import { createChart, CrosshairMode, ColorType, CandlestickSeries, BarSeries, LineSeries, HistogramSeries } from 'lightweight-charts';

const QuantChartPanel = ({ ticker, history, chartType, signals, indicatorData, loading }) => {
    const containerRef = useRef(null);
    const chartRef = useRef(null);
    const mainSeriesRef = useRef(null);
    const volumeSeriesRef = useRef(null);
    const overlaySeriesRefs = useRef([]);

    /* Convert history to chart data */
    const chartData = useMemo(() => {
        if (!history || history.length === 0) return [];

        return history.map((bar) => {
            let ts;
            const d = bar.date;
            if (typeof d === 'string') {
                const parsed = new Date(d);
                ts = Math.floor(parsed.getTime() / 1000);
            } else {
                ts = Math.floor(d);
            }

            return { time: ts, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume || 0 };
        }).filter((d) => d.time && !isNaN(d.time))
            .sort((a, b) => a.time - b.time);
    }, [history]);

    /* Heikin Ashi computation */
    const displayData = useMemo(() => {
        if (chartType !== 'Heikin Ashi' || chartData.length === 0) return chartData;

        const ha = [];
        for (let i = 0; i < chartData.length; i++) {
            const bar = chartData[i];
            const haClose = (bar.open + bar.high + bar.low + bar.close) / 4;
            const haOpen = i === 0
                ? (bar.open + bar.close) / 2
                : (ha[i - 1].open + ha[i - 1].close) / 2;
            const haHigh = Math.max(bar.high, haOpen, haClose);
            const haLow = Math.min(bar.low, haOpen, haClose);
            ha.push({ time: bar.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: bar.volume });
        }
        return ha;
    }, [chartData, chartType]);

    /* Volume data */
    const volumeData = useMemo(() => {
        return displayData.map((d) => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)',
        }));
    }, [displayData]);

    /* Signal markers */
    const markers = useMemo(() => {
        if (!signals || signals.length === 0 || displayData.length === 0) return [];

        const timeSet = new Set(displayData.map((d) => d.time));

        return signals.map((s) => {
            let ts;
            if (typeof s.date === 'string') {
                ts = Math.floor(new Date(s.date).getTime() / 1000);
            } else {
                ts = Math.floor(s.date);
            }

            /* Find closest bar time */
            if (!timeSet.has(ts)) {
                let closest = displayData[0]?.time;
                let minDiff = Infinity;
                for (const d of displayData) {
                    const diff = Math.abs(d.time - ts);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = d.time;
                    }
                }
                ts = closest;
            }

            const isBuy = s.type === 'BUY';
            return {
                time: ts,
                position: isBuy ? 'belowBar' : 'aboveBar',
                color: isBuy ? '#22c55e' : '#ef4444',
                shape: isBuy ? 'arrowUp' : 'arrowDown',
                text: s.type,
                type: s.type,
                value: s.price || 0,
                size: 1,
            };
        }).sort((a, b) => a.time - b.time);
    }, [signals, displayData]);

    /* Create / update chart */
    useEffect(() => {
        if (!containerRef.current) return;
        if (displayData.length === 0) return;

        let disposed = false;

        /* Destroy previous chart safely */
        if (chartRef.current) {
            try { chartRef.current.remove(); } catch { /* already disposed */ }
            chartRef.current = null;
            mainSeriesRef.current = null;
            volumeSeriesRef.current = null;
            overlaySeriesRefs.current = [];
        }

        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            layout: {
                background: { type: ColorType.Solid, color: '#010a14' },
                textColor: 'rgba(255, 255, 255, 0.4)',
                fontFamily: "'SF Mono', 'Fira Code', 'Inter', monospace",
                fontSize: 10,
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: 'rgba(4, 102, 200, 0.4)',
                    labelBackgroundColor: '#0466C8',
                },
                horzLine: {
                    color: 'rgba(4, 102, 200, 0.4)',
                    labelBackgroundColor: '#0466C8',
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.08)',
                scaleMargins: { top: 0.1, bottom: 0.25 },
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.08)',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
                barSpacing: 8,
            },
            handleScroll: true,
            handleScale: true,
        });

        if (disposed) { try { chart.remove(); } catch { } return; }

        chartRef.current = chart;

        /* Main price series — v5 unified API */
        let mainSeries;
        if (chartType === 'OHLC') {
            mainSeries = chart.addSeries(BarSeries, {
                upColor: '#22c55e',
                downColor: '#ef4444',
                thinBars: false,
            });
        } else {
            mainSeries = chart.addSeries(CandlestickSeries, {
                upColor: '#22c55e',
                downColor: '#ef4444',
                borderUpColor: '#22c55e',
                borderDownColor: '#ef4444',
                wickUpColor: '#22c55e',
                wickDownColor: '#ef4444',
            });
        }
        mainSeries.setData(displayData);
        mainSeriesRef.current = mainSeries;

        /* Signal markers — v5 doesn't have setMarkers, use LineSeries dots instead */
        if (markers.length > 0) {
            markers.forEach((m) => {
                const color = m.type === 'BUY' ? '#22c55e' : '#ef4444';
                const markerSeries = chart.addSeries(LineSeries, {
                    color,
                    lineWidth: 0,
                    pointMarkersVisible: true,
                    pointMarkersRadius: 4,
                    priceScaleId: 'right',
                    lastValueVisible: false,
                    priceLineVisible: false,
                });
                markerSeries.setData([{ time: m.time, value: m.position === 'belowBar' ? m.value * 0.998 : m.value * 1.002 }]);
                overlaySeriesRefs.current.push(markerSeries);
            });
        }

        /* Volume — v5 unified API */
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeries.setData(volumeData);
        volumeSeriesRef.current = volumeSeries;

        /* Indicator overlays */
        overlaySeriesRefs.current = [];

        if (indicatorData && displayData.length > 0) {
            const overlayColors = [
                '#0466C8', '#eab308', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
            ];
            let colorIdx = 0;

            Object.entries(indicatorData).forEach(([key, values]) => {
                if (!Array.isArray(values) || values.length !== displayData.length) return;

                /* Skip non-overlay data (regimes, scores, etc.) */
                const firstNumeric = values.find((v) => typeof v === 'number' && !isNaN(v));
                if (firstNumeric == null) return;

                /* Check if values are in price range (overlay) or separate scale */
                const maxPrice = Math.max(...displayData.map((d) => d.high));
                const minPrice = Math.min(...displayData.map((d) => d.low));
                const isOverlay = firstNumeric > minPrice * 0.5 && firstNumeric < maxPrice * 2;

                if (!isOverlay) return; /* Skip sub-indicators for now */

                const lineData = values
                    .map((v, i) => ({
                        time: displayData[i].time,
                        value: typeof v === 'number' && !isNaN(v) ? v : undefined,
                    }))
                    .filter((d) => d.value !== undefined);

                if (lineData.length === 0) return;

                /* v5 unified API */
                const lineSeries = chart.addSeries(LineSeries, {
                    color: overlayColors[colorIdx % overlayColors.length],
                    lineWidth: 1,
                    lineStyle: 0,
                    title: key.replace(/_/g, ' ').toUpperCase(),
                    priceLineVisible: false,
                    lastValueVisible: false,
                });
                lineSeries.setData(lineData);
                overlaySeriesRefs.current.push(lineSeries);
                colorIdx++;
            });
        }

        chart.timeScale().fitContent();

        /* Resize observer */
        const resizeObserver = new ResizeObserver((entries) => {
            if (disposed) return;
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                try { chart.applyOptions({ width, height }); } catch { /* disposed */ }
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            disposed = true;
            resizeObserver.disconnect();
            try { chart.remove(); } catch { /* already disposed */ }
            chartRef.current = null;
            mainSeriesRef.current = null;
            volumeSeriesRef.current = null;
            overlaySeriesRefs.current = [];
        };
    }, [displayData, volumeData, markers, indicatorData, chartType]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                background: '#010a14',
            }}
        >
            {loading && (
                <div style={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: 11,
                    color: 'rgba(255, 255, 255, 0.4)',
                    zIndex: 5,
                }}>
                    Loading {ticker}...
                </div>
            )}
            {!loading && displayData.length === 0 && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    fontSize: 12,
                    color: 'rgba(255, 255, 255, 0.3)',
                    textAlign: 'center',
                }}>
                    No chart data available for {ticker}
                </div>
            )}
        </div>
    );
};

export default QuantChartPanel;
