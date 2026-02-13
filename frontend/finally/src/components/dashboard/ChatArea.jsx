import { useState, useRef, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StockChart from './StockChart';
import './ChatArea.css';

const TradePreviewCard = ({ preview, onConfirm, onCancel, confirmed }) => {
  if (!preview) return null;
  const isBuy = preview.side === 'BUY';
  return (
    <div className={`trade-card ${isBuy ? 'trade-card--buy' : 'trade-card--sell'}`}>
      <div className="trade-card__header">
        <span className={`trade-card__side ${isBuy ? 'trade-card__side--buy' : 'trade-card__side--sell'}`}>
          {preview.side}
        </span>
        <span className="trade-card__ticker">{preview.ticker}</span>
        <span className="trade-card__badge">Paper Trade</span>
      </div>
      <div className="trade-card__details">
        <div className="trade-card__row">
          <span className="trade-card__label">Quantity</span>
          <span className="trade-card__value">{preview.quantity}</span>
        </div>
        <div className="trade-card__row">
          <span className="trade-card__label">Price</span>
          <span className="trade-card__value">₹{Number(preview.current_price || preview.price || preview.estimated_price || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="trade-card__row trade-card__row--total">
          <span className="trade-card__label">Total</span>
          <span className="trade-card__value">₹{Number(preview.total_cost || preview.estimated_total || preview.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
        </div>
        {preview.available_balance != null && (
          <div className="trade-card__row">
            <span className="trade-card__label">Available</span>
            <span className="trade-card__value">₹{Number(preview.available_balance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        )}
      </div>
      {preview.message && <p className="trade-card__message">{preview.message}</p>}
      {!confirmed ? (
        <div className="trade-card__actions">
          <button className="trade-card__btn trade-card__btn--confirm" onClick={() => onConfirm(preview)}>
            Confirm {preview.side}
          </button>
          <button className="trade-card__btn trade-card__btn--cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="trade-card__confirmed">
          <span className="trade-card__confirmed-icon">✓</span>
          <span>Order executed successfully</span>
        </div>
      )}
    </div>
  );
};

const CHAT_MODES = [
  { id: 'auto', label: 'Auto', prefix: '' },
  { id: 'trader', label: 'Trader', prefix: '[TRADE] ' },
  { id: 'charts', label: 'Charts', prefix: '[CHART] ' },
  { id: 'advisor', label: 'Advisor', prefix: '[ADVISOR] ' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
];

const ChatArea = ({ chat, onSendMessage, onNewChat, isAgentTyping, onTradeConfirm, onClearChat, onExportChat }) => {
  const [input, setInput] = useState('');
  const [chatMode, setChatMode] = useState('auto');
  const [language, setLanguage] = useState('en');
  const [advisorStep, setAdvisorStep] = useState(0);
  const [thinkingExpanded, setThinkingExpanded] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const ADVISOR_STEPS = [
    { text: 'Loading market data...' },
    { text: 'Analyzing fundamentals...' },
    { text: 'Running technical analysis...' },
    { text: 'Evaluating company profile...' },
    { text: 'Generating investment thesis...' },
  ];

  useEffect(() => {
    let interval;
    if (isAgentTyping && chatMode === 'advisor') {
      setAdvisorStep(0);
      interval = setInterval(() => {
        setAdvisorStep((prev) => (prev < ADVISOR_STEPS.length - 1 ? prev + 1 : prev));
      }, 2500);
    } else {
      setAdvisorStep(0);
    }
    return () => clearInterval(interval);
  }, [isAgentTyping, chatMode]);

  useEffect(() => {
    scrollToBottom();
  }, [chat?.messages, isAgentTyping, advisorStep]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const mode = CHAT_MODES.find((m) => m.id === chatMode);
    const finalMessage = (mode?.prefix || '') + input.trim();
    onSendMessage(finalMessage, language);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleExportPdf = useCallback(() => {
    if (!chat || !chat.messages || chat.messages.length === 0) return;

    const win = window.open('', '_blank');
    if (!win) return;

    const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${escapeHtml(chat.title || 'FinAlly Chat')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a2e; background: #fff; max-width: 800px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #0466C8; }
  .header h1 { font-size: 24px; color: #0466C8; margin-bottom: 4px; }
  .header .subtitle { font-size: 12px; color: #666; }
  .msg { margin-bottom: 20px; padding: 16px; border-radius: 8px; page-break-inside: avoid; }
  .msg--user { background: #f0f7ff; border-left: 3px solid #0466C8; }
  .msg--assistant { background: #f8f9fa; border-left: 3px solid #10b981; }
  .msg__sender { font-weight: 600; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .msg--user .msg__sender { color: #0466C8; }
  .msg--assistant .msg__sender { color: #10b981; }
  .msg__time { font-size: 11px; color: #999; float: right; }
  .msg__content { font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
  .msg__content p { margin-bottom: 8px; }
  .msg__content ul, .msg__content ol { padding-left: 20px; margin-bottom: 8px; }
  .trade-box { margin-top: 12px; padding: 12px; border: 1px solid #ddd; border-radius: 6px; background: #fff; }
  .trade-box__header { font-weight: 600; font-size: 14px; margin-bottom: 8px; }
  .trade-box--buy .trade-box__header { color: #10b981; }
  .trade-box--sell .trade-box__header { color: #ef4444; }
  .trade-box__row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .trade-box__label { color: #666; }
  .trade-box__val { font-weight: 500; }
  .chart-placeholder { margin-top: 12px; padding: 16px; border: 1px dashed #ccc; border-radius: 6px; text-align: center; color: #999; font-size: 13px; }
  .meta { margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap; }
  .meta__badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #e8f4fd; color: #0466C8; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #999; }
  @media print { body { padding: 20px; } .msg { break-inside: avoid; } }
</style></head><body>`;

    html += `<div class="header">
      <h1>FinAlly</h1>
      <div class="subtitle">${escapeHtml(chat.title || 'Chat Export')} &mdash; ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>`;

    chat.messages.forEach((msg) => {
      const cls = msg.role === 'user' ? 'msg--user' : 'msg--assistant';
      const sender = msg.role === 'user' ? 'You' : 'FinAlly';

      html += `<div class="msg ${cls}">`;
      html += `<div class="msg__sender">${sender}<span class="msg__time">${escapeHtml(msg.timestamp || '')}</span></div>`;
      html += `<div class="msg__content">${escapeHtml(msg.content || '')}</div>`;

      if (msg.meta?.trade_preview) {
        const p = msg.meta.trade_preview;
        const tCls = p.side === 'BUY' ? 'trade-box--buy' : 'trade-box--sell';
        html += `<div class="trade-box ${tCls}">`;
        html += `<div class="trade-box__header">${escapeHtml(p.side)} ${escapeHtml(p.ticker)}</div>`;
        html += `<div class="trade-box__row"><span class="trade-box__label">Quantity</span><span class="trade-box__val">${p.quantity}</span></div>`;
        html += `<div class="trade-box__row"><span class="trade-box__label">Price</span><span class="trade-box__val">Rs.${Number(p.current_price || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>`;
        html += `<div class="trade-box__row"><span class="trade-box__label">Total</span><span class="trade-box__val">Rs.${Number(p.total_cost || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>`;
        if (msg.meta.trade_confirmed) html += `<div class="trade-box__row"><span class="trade-box__label">Status</span><span class="trade-box__val" style="color:#10b981">Executed</span></div>`;
        html += `</div>`;
      }

      if (msg.meta?.chart_data) {
        const cd = msg.meta.chart_data;
        html += `<div class="chart-placeholder">Stock Chart: ${escapeHtml(cd.ticker || '')} (${escapeHtml(cd.period || '')}, ${cd.data?.length || 0} data points)</div>`;
      }

      if (msg.meta?.intent || msg.meta?.tickers?.length) {
        html += `<div class="meta">`;
        if (msg.meta.intent) html += `<span class="meta__badge">${escapeHtml(msg.meta.intent.replace(/_/g, ' '))}</span>`;
        (msg.meta.tickers || []).forEach((t) => { html += `<span class="meta__badge">${escapeHtml(t)}</span>`; });
        html += `</div>`;
      }

      html += `</div>`;
    });

    html += `<div class="footer">Exported from FinAlly &mdash; AI Financial Assistant &mdash; ${new Date().toLocaleString('en-IN')}</div>`;
    html += `</body></html>`;

    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  }, [chat]);

  const suggestedPrompts = [
    'Show me 5 day chart of AAPL',
    'Buy 10 shares of RELIANCE',
    'Analyze SENSEX trends this week',
    'Calculate SIP returns for 10 years',
    'Compare HDFC Bank vs ICICI Bank stocks',
    'What are the best mutual funds for beginners?',
  ];

  if (!chat) {
    return (
      <main className="chat-area">
        <div className="chat-area__welcome">
          <div className="chat-area__welcome-logo">
            <span className="chat-area__welcome-fin">Fin</span>
            <span className="chat-area__welcome-ally">Ally</span>
          </div>
          <p className="chat-area__welcome-tagline">Your Intelligent Financial Companion</p>
          <p className="chat-area__welcome-sub">
            Ask me anything about markets, investments, financial calculations, or get AI-powered insights.
          </p>

          <div className="chat-area__prompts">
            <p className="chat-area__prompts-label">Try asking</p>
            <div className="chat-area__prompts-grid">
              {suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  className="chat-area__prompt-card"
                  onClick={() => {
                    onNewChat();
                    setTimeout(() => onSendMessage(prompt), 100);
                  }}
                >
                  <span className="chat-area__prompt-text">{prompt}</span>
                  <span className="chat-area__prompt-arrow">&#8599;</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <form className="chat-area__input-bar" onSubmit={handleSubmit}>
          <div className="chat-area__mode-bar">
            {CHAT_MODES.map((mode) => (
              <button
                key={mode.id}
                type="button"
                className={`chat-area__mode-pill ${chatMode === mode.id ? 'chat-area__mode-pill--active' : ''}`}
                onClick={() => setChatMode(mode.id)}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="chat-area__input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-area__input"
              placeholder={chatMode === 'trader' ? 'e.g. Buy 10 shares of RELIANCE...' : chatMode === 'charts' ? 'e.g. Show 1 month chart of TCS...' : 'Ask FinAlly anything...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              type="submit"
              className="chat-area__send-btn"
              disabled={!input.trim()}
            >
              Send &#8599;
            </button>
          </div>
          <p className="chat-area__disclaimer">
            FinAlly provides AI-generated financial insights. Not financial advice. Always consult a professional.
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="chat-area">
      <div className="chat-area__header">
        <div className="chat-area__header-left">
          <h2 className="chat-area__chat-title">{chat.title}</h2>
          <span className="chat-area__chat-count">
            {chat.messages.length} message{chat.messages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="chat-area__header-actions">
          <button className="chat-area__header-btn" title="Clear chat" onClick={onClearChat}>Clear</button>
          <button className="chat-area__header-btn" title="Export chat as PDF" onClick={() => handleExportPdf()}>Export</button>
        </div>
      </div>

      <div className="chat-area__messages">
        {chat.messages.length === 0 ? (
          <div className="chat-area__messages-empty">
            <p className="chat-area__messages-empty-text">Start your conversation</p>
            <div className="chat-area__prompts-grid chat-area__prompts-grid--compact">
              {suggestedPrompts.slice(0, 4).map((prompt, i) => (
                <button
                  key={i}
                  className="chat-area__prompt-card"
                  onClick={() => onSendMessage(prompt)}
                >
                  <span className="chat-area__prompt-text">{prompt}</span>
                  <span className="chat-area__prompt-arrow">&#8599;</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          chat.messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-area__message chat-area__message--${msg.role}`}
            >
              <div className="chat-area__message-avatar">
                {msg.role === 'user' ? 'You' : 'FA'}
              </div>
              <div className="chat-area__message-body">
                <div className="chat-area__message-header">
                  <span className="chat-area__message-sender">
                    {msg.role === 'user' ? 'You' : 'FinAlly'}
                  </span>
                  <span className="chat-area__message-time">{msg.timestamp}</span>
                </div>
                <div className="chat-area__message-content">
                  {msg.role === 'assistant' ? (
                    <>
                      {msg.meta?.advisor_thinking && (
                        <div className="chat-area__thinking">
                          <button
                            className="chat-area__thinking-toggle"
                            onClick={() => setThinkingExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                          >
                            <span>{thinkingExpanded[i] ? '▼' : '▶'}</span>
                            <span>Thinking Process</span>
                            <span style={{ opacity: 0.5, fontSize: '0.8em', marginLeft: 'auto' }}>
                              {msg.meta.advisor_thinking.length} steps
                            </span>
                          </button>
                          {thinkingExpanded[i] && (
                            <div className="chat-area__thinking-content">
                              {msg.meta.advisor_thinking.map((step, idx) => (
                                <div key={idx} className="chat-area__thinking-step">
                                  <div className="chat-area__thinking-step-header">
                                    <span className="chat-area__thinking-step-title">{step.title}</span>
                                  </div>
                                  <div className="chat-area__thinking-step-detail">{step.detail}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="chat-area__markdown"><Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown></div>
                      {msg.meta?.chart_data && (
                        <StockChart chartData={msg.meta.chart_data} />
                      )}
                      {msg.meta?.trade_preview && (
                        <TradePreviewCard
                          preview={msg.meta.trade_preview}
                          onConfirm={(p) => onTradeConfirm && onTradeConfirm(p, i)}
                          onCancel={() => { }}
                          confirmed={msg.meta.trade_confirmed}
                        />
                      )}
                    </>
                  ) : (
                    msg.content.split('\n').map((line, j) => (
                      <p key={j} className="chat-area__message-line">{line}</p>
                    ))
                  )}
                </div>
                {msg.meta && (
                  <div className="chat-area__message-meta">
                    {msg.meta.intent && (
                      <span className="chat-area__meta-badge">{msg.meta.intent.replace(/_/g, ' ')}</span>
                    )}
                    {msg.meta.tickers?.map((t) => (
                      <span key={t} className="chat-area__meta-badge chat-area__meta-badge--ticker">{t}</span>
                    ))}
                  </div>
                )}
                {msg.isError && (
                  <span className="chat-area__message-error-tag">Connection Error</span>
                )}
              </div>
            </div>
          ))
        )}

        {isAgentTyping && (
          <div className="chat-area__message chat-area__message--assistant">
            <div className="chat-area__message-avatar">FA</div>
            <div className="chat-area__message-body">
              {chatMode === 'advisor' ? (
                <div className="chat-area__thinking-live">
                  <span className="chat-area__thinking-text">{ADVISOR_STEPS[advisorStep]?.text}</span>
                  <span className="chat-area__typing-dot" style={{ marginLeft: 8 }} />
                </div>
              ) : (
                <div className="chat-area__typing">
                  <span className="chat-area__typing-dot" />
                  <span className="chat-area__typing-dot" />
                  <span className="chat-area__typing-dot" />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-area__input-bar" onSubmit={handleSubmit}>

        <div className="chat-area__mode-bar">
          {CHAT_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`chat-area__mode-pill ${chatMode === mode.id ? 'chat-area__mode-pill--active' : ''}`}
              onClick={() => setChatMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
          <select
            className="chat-area__language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
        <div className="chat-area__input-wrapper">
          <textarea
            ref={inputRef}
            className="chat-area__input"
            placeholder={chatMode === 'trader' ? 'e.g. Buy 10 shares of RELIANCE...' : chatMode === 'charts' ? 'e.g. Show 1 month chart of TCS...' : chatMode === 'advisor' ? 'e.g. Analyze SILVERBEES investment...' : 'Ask FinAlly anything...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            type="submit"
            className="chat-area__send-btn"
            disabled={!input.trim()}
          >
            Send &#8599;
          </button>
        </div>
        <p className="chat-area__disclaimer">
          FinAlly provides AI-generated financial insights. Not financial advice. Always consult a professional.
        </p>
      </form>
    </main >
  );
};

export default ChatArea;
