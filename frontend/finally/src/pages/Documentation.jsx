import React from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardNavbar from '../components/dashboard/DashboardNavbar';
import './Documentation.css';

const Documentation = () => {
    const navigate = useNavigate();

    return (
        <div className="documentation-page">
            <DashboardNavbar />
            <div className="doc-container">
                <aside className="doc-sidebar">
                    <h3>Guide</h3>
                    <ul>
                        <li><a href="#overview">Overview</a></li>
                        <li><a href="#chat-modes">Chat Modes</a></li>
                        <li><a href="#trading">Placing Trades</a></li>
                        <li><a href="#charts">Market Charts</a></li>
                        <li><a href="#advisor">Advisor Mode</a></li>
                    </ul>
                    <button onClick={() => navigate('/dashboard')} className="back-btn">
                        &larr; Back to Dashboard
                    </button>
                </aside>

                <main className="doc-content">
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
                                <p>The default mode. It automatically detects your intent—whether you want a chart, a trade, or advice.</p>
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
                                <p>New! Deep-dive analysis. The AI thinks step-by-step through fundamentals, technicals, and macro factors to give you a structured investment thesis.</p>
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
                        <h2>Advisor Mode</h2>
                        <p>For complex investment decisions, switch to <strong>Advisor</strong> mode (<code>[ADVISOR]</code> prefix). The AI will:</p>
                        <ol>
                            <li>Fetch real-time quotes and fundamentals.</li>
                            <li>Analyze technical trends (RSI, Moving Averages).</li>
                            <li>Evaluate the company profile and macro environment.</li>
                            <li>Generate a "Bull Case" and "Bear Case".</li>
                            <li>Give a final, opinionated verdict (Buy/Wait/Sell).</li>
                        </ol>
                        <p>You can see the AI's "Thinking Process" by expanding the dropdown in the response.</p>
                    </section>
                </main>
            </div>
        </div>
    );
};

export default Documentation;
