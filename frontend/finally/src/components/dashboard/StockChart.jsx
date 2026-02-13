import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  ComposedChart,
  Line,
} from 'recharts';
import './StockChart.css';

const VIEWS = ['area', 'line', 'candle'];
const ACCENT = '#0466C8';
const GREEN = '#00c853';
const RED = '#ff1744';

const formatDate = (raw) => {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const formatTime = (raw) => {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d)) return raw;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatLabel = (raw, period) => {
  if (['1d'].includes(period)) return formatTime(raw);
  return formatDate(raw);
};

const formatPrice = (v) => {
  if (v == null) return '';
  if (v >= 100) return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  return `₹${v.toFixed(2)}`;
};

const CustomTooltip = ({ active, payload, label, period }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="stock-chart__tooltip">
      <p className="stock-chart__tooltip-date">{formatLabel(label, period)}</p>
      {d?.open != null && (
        <div className="stock-chart__tooltip-grid">
          <span>O</span><span>{formatPrice(d.open)}</span>
          <span>H</span><span>{formatPrice(d.high)}</span>
          <span>L</span><span>{formatPrice(d.low)}</span>
          <span>C</span><span className={d.close >= d.open ? 'stock-chart__green' : 'stock-chart__red'}>
            {formatPrice(d.close)}
          </span>
          {d.volume != null && (
            <><span>Vol</span><span>{(d.volume / 1000).toFixed(0)}K</span></>
          )}
        </div>
      )}
      {d?.close != null && d?.open == null && (
        <p className="stock-chart__tooltip-price">{formatPrice(d.close)}</p>
      )}
    </div>
  );
};

const StockChart = ({ chartData }) => {
  const [view, setView] = useState('area');

  if (!chartData?.data?.length) return null;

  const { ticker, period, data } = chartData;

  const processed = data.map((d) => ({
    ...d,
    date: d.date || d.Date || d.timestamp,
    close: d.close ?? d.Close,
    open: d.open ?? d.Open,
    high: d.high ?? d.High,
    low: d.low ?? d.Low,
    volume: d.volume ?? d.Volume,
  }));

  const closes = processed.map((d) => d.close).filter(Boolean);
  const minPrice = Math.min(...closes);
  const maxPrice = Math.max(...closes);
  const padding = (maxPrice - minPrice) * 0.05 || 1;
  const firstClose = closes[0] || 0;
  const lastClose = closes[closes.length - 1] || 0;
  const change = lastClose - firstClose;
  const changePct = firstClose ? ((change / firstClose) * 100).toFixed(2) : '0.00';
  const isPositive = change >= 0;
  const chartColor = isPositive ? GREEN : RED;

  return (
    <div className="stock-chart">
      <div className="stock-chart__header">
        <div className="stock-chart__header-left">
          <span className="stock-chart__ticker">{ticker}</span>
          <span className="stock-chart__price">{formatPrice(lastClose)}</span>
          <span className={`stock-chart__change ${isPositive ? 'stock-chart__green' : 'stock-chart__red'}`}>
            {isPositive ? '+' : ''}{formatPrice(change)} ({isPositive ? '+' : ''}{changePct}%)
          </span>
        </div>
        <div className="stock-chart__header-right">
          <span className="stock-chart__period">{period}</span>
          <div className="stock-chart__view-toggle">
            {VIEWS.map((v) => (
              <button
                key={v}
                className={`stock-chart__view-btn ${view === v ? 'stock-chart__view-btn--active' : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'area' ? '▤' : v === 'line' ? '━' : '┃'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stock-chart__canvas">
        <ResponsiveContainer width="100%" height={260}>
          {view === 'candle' ? (
            <ComposedChart data={processed} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatLabel(v, period)}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={[minPrice - padding, maxPrice + padding]}
                tickFormatter={formatPrice}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={65}
              />
              <Tooltip content={<CustomTooltip period={period} />} />
              <Bar dataKey="high" fill="transparent" />
              <Line type="monotone" dataKey="high" stroke={GREEN} dot={false} strokeWidth={1} opacity={0.4} />
              <Line type="monotone" dataKey="low" stroke={RED} dot={false} strokeWidth={1} opacity={0.4} />
              <Line type="monotone" dataKey="close" stroke={ACCENT} dot={false} strokeWidth={1.5} />
            </ComposedChart>
          ) : (
            <AreaChart data={processed} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`chartGrad_${ticker}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={chartColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatLabel(v, period)}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={[minPrice - padding, maxPrice + padding]}
                tickFormatter={formatPrice}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={65}
              />
              <Tooltip content={<CustomTooltip period={period} />} />
              {view === 'area' ? (
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  fill={`url(#chartGrad_${ticker})`}
                  animationDuration={800}
                />
              ) : (
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  fill="transparent"
                  animationDuration={800}
                />
              )}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="stock-chart__footer">
        <span className="stock-chart__footer-label">
          {processed.length} data points &middot; {chartData.interval || 'auto'} interval
        </span>
      </div>
    </div>
  );
};

export default StockChart;
