import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardNavbar from '../components/dashboard/DashboardNavbar';
import './Documentation.css';

const CHANGELOG = [
    {
        version: 'v2.1.0',
        date: '2026-03-31',
        tag: 'Latest',
        changes: [
            {
                type: 'major',
                title: 'Sophisticated NLU Prompt Engine',
                description: 'Completely rebuilt the prompt inference system into a production-grade Natural Language Understanding (NLU) engine. Now handles casual language ("wanna see reliance chart"), Hinglish queries ("TCS mein paisa lagaun kya"), typos ("rleiance"), and ambiguous intent with high confidence scoring. Includes multi-entity extraction (tickers, quantity, side, time period) and graceful fallback.'
            },
            {
                type: 'major',
                title: 'Extended High-Effort Thinking Mode in Advisor',
                description: 'Advisor Mode now runs a 9-step deep research pipeline: Initialize → Live Data → Fundamental Health → Technical Momentum (RSI, SMA-20, SMA-50, Volume Ratio) → Company Profiling → 1-Year Price Context → News & Sentiment → Risk Calibration → Investment Thesis. The system prompt has been upgraded to produce full investment theses including Bull/Bear Duel, entry zone, stop-loss, target zone, and position sizing guidance.'
            },
            {
                type: 'major',
                title: 'Latest Changes Tab in Documentation',
                description: 'Added this versioned changelog tab to the Documentation page accessible from Profile dropdown. Tracks all major/minor updates with version control numbering (semver).'
            },
            {
                type: 'minor',
                title: 'v2.1.0 Release Alert Banner',
                description: 'Added an animated release notification in the Dashboard chat welcome area with a link to this changelog page.'
            },
            {
                type: 'minor',
                title: 'Demo Video on Landing Page',
                description: 'Added a "See FinAlly in Action" demo section between Features and About on the landing page. Features a full-width video player with brand-themed glow border and GSAP scroll-reveal animation.'
            },
            {
                type: 'minor',
                title: 'Advisor Thinking Steps Expanded',
                description: 'Increased Advisor Mode live thinking steps from 5 to 9 in the frontend, matching the new backend pipeline stages for a more transparent and immersive experience.'
            },
            {
                type: 'major',
                title: 'Razorpay Sandbox Mock Payment System',
                description: 'Replaced the custom payment overlay with an authentic Razorpay Test Checkout UI. Features Razorpay\'s signature dark navy header, tabbed payment methods (Cards / UPI / Net Banking), test credential hints (card: 4111 1111 1111 1111, UPI: success@razorpay), mock payment IDs in Razorpay format (pay_XXXXXXXXXXXXXXXX), and "Powered by Razorpay" footer branding.'
            },
            {
                type: 'major',
                title: 'FinAlly Logo + Animated Chat Loader',
                description: 'Designed a bespoke FinAlly SVG logo — a stylised "F" with an integrated rising trend-line on a blue rounded square. Added to the landing navbar beside the "FinAlly" wordmark. Replaced the plain three-dot chat loader with an animated logo loader: spinning arc ring + pulsing logo center.'
            },
            {
                type: 'minor',
                title: 'Demo Video Autoplay on Scroll',
                description: 'The demo video on the landing page now autoplays (with muted fallback) when it enters 50% of the viewport, and pauses automatically when scrolled away. Uses IntersectionObserver for performance — no JS timers.'
            },
            {
                type: 'fix',
                title: 'Enhanced Ticker Extraction for Company Names',
                description: 'LLM classifier now ships with a comprehensive 50+ company name → ticker lookup map for Indian and US stocks, ETFs, and indices. Casual references like "sbi", "kotak", "apple", "nvidia" are reliably resolved to their correct symbols.'
            },
            {
                type: 'fix',
                title: 'Hindi Number Word Support in Quantity Parsing',
                description: 'Quantity extraction now understands Hindi number words: "do share" = 2, "das" = 10, "ek sau" = 100, etc. Improves trade order accuracy for Hindi-speaking users.'
            },
        ]
    },
    {
        version: 'v2.0.0',
        date: '2026-03-20',
        tag: 'Stable',
        changes: [
            { type: 'major', title: 'LLM-Based Intent Classifier', description: 'Replaced pure keyword matching with an OpenAI-powered intent classifier with keyword fallback.' },
            { type: 'major', title: 'Advisor Mode with Thinking Process', description: 'Added Advisor mode with visible step-by-step thinking process display in chat.' },
            { type: 'major', title: 'Quant Trading Terminal', description: 'Launched the Quant Terminal with 20 strategies, SSE streaming, and WebSocket live prices.' },
            { type: 'minor', title: 'Multilingual Support', description: 'Added language selector (EN, HI, ES, FR, DE) with auto-translation for non-English queries.' },
            { type: 'minor', title: 'Chat Export to PDF', description: 'Users can now export any conversation as a print-ready PDF.' },
            { type: 'fix', title: 'yfinance Cache Fix', description: 'Resolved authentication/crumb errors in yfinance by auto-clearing cache on module load.' },
        ]
    },
    {
        version: 'v1.5.0',
        date: '2026-03-01',
        tag: '',
        changes: [
            { type: 'major', title: 'OTP 2FA Authentication', description: 'Implemented full 2-factor authentication using pyotp TOTP with Gmail SMTP delivery.' },
            { type: 'major', title: 'Candlestick Chart Engine', description: 'Integrated Lightweight Charts for interactive OHLCV candlestick charts with zoom/pan.' },
            { type: 'minor', title: 'Watchlist System', description: 'Added per-user watchlist (up to 10 tickers) with CRUD operations.' },
            { type: 'minor', title: 'Conversation Persistence', description: 'Chat history now saved to MongoDB per user, with sidebar for history navigation.' },
        ]
    },
];

const tagColors = {
    major: { label: 'Major', color: '#0466C8' },
    minor: { label: 'Minor', color: '#3d9a50' },
    fix: { label: 'Fix', color: '#b36a00' },
};

const Documentation = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'guide';

    const setTab = (tab) => setSearchParams({ tab });

    return (
        <div className="documentation-page">
            <DashboardNavbar />
            <div className="doc-container">
                <aside className="doc-sidebar">
                    <h3>Navigation</h3>
                    <div className="doc-tab-nav">
                        <button
                            className={`doc-tab-btn ${activeTab === 'guide' ? 'doc-tab-btn--active' : ''}`}
                            onClick={() => setTab('guide')}
                        >
                            User Guide
                        </button>
                        <button
                            className={`doc-tab-btn ${activeTab === 'changelog' ? 'doc-tab-btn--active' : ''}`}
                            onClick={() => setTab('changelog')}
                        >
                            Latest Changes
                            <span className="doc-tab-badge">v2.1</span>
                        </button>
                    </div>

                    {activeTab === 'guide' && (
                        <ul>
                            <li><a href="#overview">Overview</a></li>
                            <li><a href="#chat-modes">Chat Modes</a></li>
                            <li><a href="#trading">Placing Trades</a></li>
                            <li><a href="#charts">Market Charts</a></li>
                            <li><a href="#advisor">Advisor Mode</a></li>
                        </ul>
                    )}
                    <button onClick={() => navigate('/dashboard')} className="back-btn">
                        &larr; Back to Dashboard
                    </button>
                </aside>

                <main className="doc-content">
                    {activeTab === 'guide' ? (
                        <>
                            <h1>FinAlly User Guide</h1>
                            <p className="lead">Welcome to FinAlly, your AI-powered financial trading companion. This guide will help you navigate the dashboard and make the most of our features.</p>

                            <section id="overview">
                                <h2>Dashboard Overview</h2>
                                <p>The dashboard is your command center. It features a real-time market ticker, a chat interface for AI interaction, and a portfolio summary. The layout is designed for speed and clarity.</p>
                            </section>

                            <section id="chat-modes">
                                <h2>Chat Modes</h2>
                                <p>The chat bar has four distinct modes to tailor the AI's behavior:</p>
                                <div className="feature-grid">
                                    <div className="feature-card">
                                        <h3>Auto</h3>
                                        <p>The default mode. It automatically detects your intent—whether you want a chart, a trade, or advice. Uses the sophisticated NLU engine to understand even casual phrasing.</p>
                                    </div>
                                    <div className="feature-card">
                                        <h3>Trader</h3>
                                        <p>Optimized for execution. Use commands like <code>Buy 10 TCS</code> or <code>Sell 50 RELIANCE at market</code>. The AI will strictly focus on order creation.</p>
                                    </div>
                                    <div className="feature-card">
                                        <h3>Charts</h3>
                                        <p>Focuses on technical analysis. Ask for <code>REL 1 month chart</code> to get interactive candlestick charts with volume data.</p>
                                    </div>
                                    <div className="feature-card">
                                        <h3>Advisor</h3>
                                        <p>Deep-dive analysis mode. Runs a 9-step Extended Thinking pipeline through fundamentals, technicals (RSI, SMA), company profile, 1-year context, news sentiment, and risk calibration to give you a complete investment thesis.</p>
                                    </div>
                                </div>
                            </section>

                            <section id="trading">
                                <h2>Placing Trades</h2>
                                <p>To place a trade, simply type your order. The AI will interpret it and present a <strong>Trade Preview Card</strong>.</p>
                                <ul>
                                    <li>Review the Quantity, Price, and Total Value.</li>
                                    <li>Click <span style={{ color: '#00e676' }}>Confirm</span> to execute the trade immediately.</li>
                                    <li>Click <span style={{ color: '#ff5252' }}>Cancel</span> to discard it.</li>
                                </ul>
                                <p><em>Note: Ensure you have sufficient funds in your wallet.</em></p>
                            </section>

                            <section id="charts">
                                <h2>Market Charts</h2>
                                <p>We provide interactive candlestick charts. You can:</p>
                                <ul>
                                    <li>Hover over candles to see Open, High, Low, Close (OHLC) data.</li>
                                    <li>Zoom in and out using your mouse wheel.</li>
                                    <li>Pan across time periods by dragging.</li>
                                </ul>
                            </section>

                            <section id="advisor">
                                <h2>Advisor Mode — Extended Thinking</h2>
                                <p>For complex investment decisions, switch to <strong>Advisor</strong> mode (<code>[ADVISOR]</code> prefix). The AI runs a 9-step research pipeline:</p>
                                <ol>
                                    <li>Initializes research session</li>
                                    <li>Fetches live market data (OHLCV, PE, 52W range, Beta)</li>
                                    <li>Assesses fundamental health (valuation, earnings power)</li>
                                    <li>Runs technical momentum scan (RSI, SMA-20, SMA-50, volume ratio)</li>
                                    <li>Profiles company and sector (business model, competitive moat)</li>
                                    <li>Maps 1-year price context (annual change, highs/lows)</li>
                                    <li>Scans news and sentiment signals</li>
                                    <li>Calibrates risk and portfolio sizing</li>
                                    <li>Synthesizes complete investment thesis</li>
                                </ol>
                                <p>The output includes an Executive Summary, 3-Pillar Deep Dive, Bull vs Bear Duel, and a Final Verdict with entry zone, stop-loss, and position sizing.</p>
                                <p>You can see the AI's "Thinking Process" by expanding the dropdown in the response.</p>
                            </section>
                        </>
                    ) : (
                        <>
                            <h1>Latest Changes</h1>
                            <p className="lead">Version history and release notes for FinAlly. We follow semantic versioning (MAJOR.MINOR.PATCH).</p>

                            <div className="changelog">
                                {CHANGELOG.map((release) => (
                                    <div key={release.version} className="changelog__release">
                                        <div className="changelog__release-header">
                                            <span className="changelog__version">{release.version}</span>
                                            {release.tag && (
                                                <span className={`changelog__tag ${release.tag === 'Latest' ? 'changelog__tag--latest' : ''}`}>
                                                    {release.tag}
                                                </span>
                                            )}
                                            <span className="changelog__date">{release.date}</span>
                                        </div>
                                        <ul className="changelog__list">
                                            {release.changes.map((change, i) => (
                                                <li key={i} className="changelog__item">
                                                    <span
                                                        className="changelog__type-badge"
                                                        style={{ background: `${tagColors[change.type]?.color}22`, color: tagColors[change.type]?.color, border: `1px solid ${tagColors[change.type]?.color}44` }}
                                                    >
                                                        {tagColors[change.type]?.label}
                                                    </span>
                                                    <div className="changelog__item-body">
                                                        <strong className="changelog__item-title">{change.title}</strong>
                                                        <p className="changelog__item-desc">{change.description}</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
};

export default Documentation;
