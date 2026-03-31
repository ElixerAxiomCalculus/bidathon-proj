/**
 * Razorpay Sandbox Mock — PaymentOverlay v2.1
 *
 * Replicates the authentic Razorpay Test Checkout experience:
 * - Razorpay branding, layout and color scheme
 * - Supports Cards, UPI, Net Banking tabs
 * - Accepts Razorpay's documented test credentials:
 *     Card  : 4111 1111 1111 1111  |  Expiry: any future  |  CVV: any 3 digits
 *     UPI   : success@razorpay  (always succeeds)
 *             failure@razorpay  (always fails)
 * - Generates a mock payment_id in Razorpay format (pay_XXXXXXXXXXXXXXXX)
 * - Shows "Powered by Razorpay" footer with SVG logo
 *
 * On success → calls onSuccess(amount) to credit the FinAlly wallet.
 */

import { useState, useEffect, useRef } from 'react';
import './PaymentOverlay.css';

/* ── Razorpay SVG logo (inline, no external dep) ────────────────────────── */
const RazorpayLogo = ({ height = 18 }) => (
  <svg height={height} viewBox="0 0 107 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Razorpay">
    <path d="M13.92 0L0 17.5h8.4L6.72 28l14-17.5h-8.4L13.92 0z" fill="#3395FF"/>
    <path d="M6.72 28l1.68-10.5H0L6.72 28z" fill="#1A6FDF"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M30.5 8.5h5.7c1.4 0 2.5.3 3.2 1 .7.6 1 1.5 1 2.6 0 1-.3 1.8-.8 2.4-.5.6-1.2 1-2.1 1.2l3.4 5.4h-3.1l-3-5h-1.8v5H30.5V8.5zm3.5 5.3h1.9c.8 0 1.4-.2 1.7-.5.4-.3.5-.7.5-1.3 0-.5-.2-1-.5-1.2-.4-.3-.9-.4-1.7-.4h-1.9v3.4zm11.5 1.9l-1.6-4.8h-.1l-1.6 4.8h3.3zm2.1 5.4h-3.2l-.9-2.7h-4.5l-.9 2.7h-3.2l4.9-13.1h2.9l4.9 13.1zm8.4-10.6H52v2.5h4.2v2.4H52v3.3h4.5v2.4H49V8.5h7.5v2.5zm6.2 0h-3.5V8.5h10.5v2.5h-3.5v10.6h-3.5V10.5zm10.7 4.3c0-2.1.5-3.7 1.6-4.9 1.1-1.2 2.6-1.8 4.5-1.8 1.9 0 3.4.6 4.5 1.8 1.1 1.2 1.6 2.8 1.6 4.9s-.5 3.7-1.6 4.9c-1.1 1.2-2.6 1.8-4.5 1.8-1.9 0-3.4-.6-4.5-1.8-1.1-1.2-1.6-2.9-1.6-4.9zm3.6 0c0 1.3.2 2.3.7 3 .5.7 1.1 1 2 1 .8 0 1.5-.3 2-1 .5-.7.7-1.7.7-3s-.2-2.3-.7-3c-.5-.7-1.1-1-2-1-.8 0-1.5.3-2 1-.5.7-.7 1.7-.7 3zm14.3-4.3h-3.6V8.5h10.5v2.5h-3.6v10.6h-3.3V10.5zm10.4-2h3.3v5.2l4.5-5.2h4l-5 5.5 5.3 7.6h-4l-3.5-5.3-1.3 1.4v3.9h-3.3V8.5z" fill="#fff"/>
  </svg>
);

/* ── Test credential hints ────────────────────────────────────────────────── */
const TEST_HINTS = {
  card: [
    { label: 'Test card (always success)', value: '4111 1111 1111 1111' },
    { label: 'Expiry', value: '12/26 · CVV: 123' },
  ],
  upi: [
    { label: 'Success UPI', value: 'success@razorpay' },
    { label: 'Failure UPI', value: 'failure@razorpay' },
  ],
};

const BANKS = [
  { id: 'sbi', name: 'SBI' },
  { id: 'hdfc', name: 'HDFC Bank' },
  { id: 'icici', name: 'ICICI Bank' },
  { id: 'axis', name: 'Axis Bank' },
  { id: 'kotak', name: 'Kotak' },
  { id: 'pnb', name: 'PNB' },
  { id: 'bob', name: 'Bank of Baroda' },
  { id: 'yes', name: 'Yes Bank' },
];

/* ── Utility ─────────────────────────────────────────────────────────────── */
const genPaymentId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return 'pay_' + Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const formatCardNumber = (val) =>
  val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

const formatExpiry = (val) => {
  const d = val.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
};

/* ═══════════════════════════════════════════════════════════════════════════ */

const PaymentOverlay = ({ isOpen, onClose, onSuccess, currentBalance }) => {
  const [tab, setTab] = useState('card');
  const [amount, setAmount] = useState('');
  const [amountConfirmed, setAmountConfirmed] = useState(false);
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null); // null | { ok: bool, paymentId?: str, msg?: str }
  const [error, setError] = useState('');
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTab('card'); setAmount(''); setAmountConfirmed(false);
      setCard({ number: '', expiry: '', cvv: '', name: '' });
      setUpiId(''); setBank(''); setProcessing(false); setResult(null); setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const parsed = parseFloat(amount) || 0;

  /* ── Validation ──────────────────────────────────────────────────────── */
  const validate = () => {
    if (tab === 'card') {
      const num = card.number.replace(/\s/g, '');
      if (num.length < 16) return 'Enter a valid 16-digit card number';
      if (card.expiry.length < 5) return 'Enter a valid expiry (MM/YY)';
      if (card.cvv.length < 3) return 'Enter a valid CVV';
      if (!card.name.trim()) return 'Enter the cardholder name';
    } else if (tab === 'upi') {
      if (!upiId.includes('@')) return 'Enter a valid UPI ID (e.g. success@razorpay)';
    } else if (tab === 'netbanking') {
      if (!bank) return 'Please select a bank';
    }
    return null;
  };

  /* ── Payment handler ─────────────────────────────────────────────────── */
  const handlePay = async () => {
    const err = validate();
    if (err) { setError(err); return; }

    // Razorpay test: failure@razorpay always fails
    if (tab === 'upi' && upiId.trim() === 'failure@razorpay') {
      setError('Payment failed: VPA not found or transaction declined.');
      return;
    }

    setError('');
    setProcessing(true);

    // Simulate network delay (Razorpay takes ~2s for sandbox)
    await new Promise(r => setTimeout(r, 2200));

    try {
      await onSuccess(parsed);
      setResult({ ok: true, paymentId: genPaymentId() });
    } catch (e) {
      setResult({ ok: false, msg: e.message || 'Payment could not be processed.' });
    } finally {
      setProcessing(false);
    }
  };

  /* ── Backdrop click ──────────────────────────────────────────────────── */
  const handleBackdrop = (e) => {
    if (e.target === overlayRef.current && !processing) onClose();
  };

  /* ════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="rzp-overlay" ref={overlayRef} onClick={handleBackdrop}>
      <div className="rzp-modal">

        {/* ── Top brand bar ─────────────────────────────────────────────── */}
        <div className="rzp-modal__brand-bar">
          <div className="rzp-modal__merchant">
            <div className="rzp-modal__merchant-logo">F</div>
            <div>
              <div className="rzp-modal__merchant-name">FinAlly</div>
              <div className="rzp-modal__merchant-sub">Secure Wallet Top-up</div>
            </div>
          </div>
          {!processing && !result && (
            <button className="rzp-modal__close" onClick={onClose} aria-label="Close">✕</button>
          )}
        </div>

        {/* ── Amount strip ──────────────────────────────────────────────── */}
        {!result && (
          <div className="rzp-modal__amount-strip">
            {!amountConfirmed ? (
              <div className="rzp-modal__amount-input-area">
                <span className="rzp-modal__amount-label">Enter Amount</span>
                <div className="rzp-modal__amount-field-wrap">
                  <span className="rzp-modal__rupee">₹</span>
                  <input
                    type="number"
                    className="rzp-modal__amount-field"
                    placeholder="0"
                    value={amount}
                    onChange={e => { setAmount(e.target.value); setError(''); }}
                    autoFocus
                    min={100}
                  />
                </div>
                <div className="rzp-modal__presets">
                  {[1000, 5000, 10000, 25000, 50000].map(a => (
                    <button key={a} className={`rzp-modal__preset ${parsed === a ? 'rzp-modal__preset--active' : ''}`}
                      onClick={() => setAmount(String(a))}>
                      ₹{a.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
                {error && <p className="rzp-modal__err">{error}</p>}
                <button className="rzp-modal__proceed-btn" disabled={parsed < 100}
                  onClick={() => {
                    if (parsed < 100) { setError('Minimum ₹100'); return; }
                    setError(''); setAmountConfirmed(true);
                  }}>
                  Proceed to Pay
                </button>
              </div>
            ) : (
              <div className="rzp-modal__amount-confirmed">
                <span className="rzp-modal__amount-display">₹{parsed.toLocaleString('en-IN')}</span>
                <button className="rzp-modal__amount-edit" onClick={() => setAmountConfirmed(false)}>Edit</button>
                <div className="rzp-modal__secure-badge">
                  <span className="rzp-modal__lock">🔒</span> Secure
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Processing ────────────────────────────────────────────────── */}
        {processing && (
          <div className="rzp-modal__processing">
            <div className="rzp-modal__spinner" />
            <p className="rzp-modal__proc-title">Processing Payment</p>
            <p className="rzp-modal__proc-sub">Please wait. Do not close this window.</p>
          </div>
        )}

        {/* ── Success ───────────────────────────────────────────────────── */}
        {result?.ok && (
          <div className="rzp-modal__result rzp-modal__result--success">
            <div className="rzp-modal__result-icon rzp-modal__result-icon--success">
              <svg viewBox="0 0 48 48" fill="none" width="52" height="52">
                <circle cx="24" cy="24" r="24" fill="#00C853"/>
                <path d="M13 24l8 8 14-16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="rzp-modal__result-title">Payment Successful</h3>
            <p className="rzp-modal__result-amount">₹{parsed.toLocaleString('en-IN')}</p>
            <p className="rzp-modal__result-id">Payment ID: <code>{result.paymentId}</code></p>
            <p className="rzp-modal__result-sub">Funds added to your FinAlly wallet</p>
            <button className="rzp-modal__done-btn" onClick={onClose}>Done</button>
          </div>
        )}

        {/* ── Failure ───────────────────────────────────────────────────── */}
        {result?.ok === false && (
          <div className="rzp-modal__result rzp-modal__result--fail">
            <div className="rzp-modal__result-icon rzp-modal__result-icon--fail">
              <svg viewBox="0 0 48 48" fill="none" width="52" height="52">
                <circle cx="24" cy="24" r="24" fill="#FF3D00"/>
                <path d="M16 16l16 16M32 16l-16 16" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="rzp-modal__result-title">Payment Failed</h3>
            <p className="rzp-modal__result-sub">{result.msg || 'Something went wrong. Please try again.'}</p>
            <button className="rzp-modal__done-btn rzp-modal__done-btn--retry"
              onClick={() => setResult(null)}>Try Again</button>
          </div>
        )}

        {/* ── Payment methods (only when amount confirmed & not processing/done) */}
        {amountConfirmed && !processing && !result && (
          <div className="rzp-modal__body">
            {/* Tab nav */}
            <div className="rzp-modal__tabs" role="tablist">
              {[
                { id: 'card', label: 'Cards' },
                { id: 'upi', label: 'UPI' },
                { id: 'netbanking', label: 'Net Banking' },
              ].map(t => (
                <button key={t.id} role="tab" aria-selected={tab === t.id}
                  className={`rzp-modal__tab ${tab === t.id ? 'rzp-modal__tab--active' : ''}`}
                  onClick={() => { setTab(t.id); setError(''); }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Card form ─────────────────────────────────────────────── */}
            {tab === 'card' && (
              <div className="rzp-modal__form">
                <div className="rzp-modal__test-hint">
                  <span className="rzp-modal__test-badge">TEST</span>
                  <span>Card: <strong>4111 1111 1111 1111</strong> · Expiry: <strong>12/26</strong> · CVV: <strong>123</strong></span>
                </div>
                <div className="rzp-modal__field">
                  <label className="rzp-modal__label">Card Number</label>
                  <input className="rzp-modal__input" placeholder="1234 5678 9012 3456"
                    value={card.number} maxLength={19}
                    onChange={e => { setCard({ ...card, number: formatCardNumber(e.target.value) }); setError(''); }} />
                </div>
                <div className="rzp-modal__field-row">
                  <div className="rzp-modal__field">
                    <label className="rzp-modal__label">Expiry (MM/YY)</label>
                    <input className="rzp-modal__input" placeholder="MM/YY"
                      value={card.expiry} maxLength={5}
                      onChange={e => { setCard({ ...card, expiry: formatExpiry(e.target.value) }); setError(''); }} />
                  </div>
                  <div className="rzp-modal__field">
                    <label className="rzp-modal__label">CVV</label>
                    <input className="rzp-modal__input" type="password" placeholder="•••"
                      value={card.cvv} maxLength={4}
                      onChange={e => { setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }); setError(''); }} />
                  </div>
                </div>
                <div className="rzp-modal__field">
                  <label className="rzp-modal__label">Name on Card</label>
                  <input className="rzp-modal__input" placeholder="Full name"
                    value={card.name}
                    onChange={e => { setCard({ ...card, name: e.target.value }); setError(''); }} />
                </div>
              </div>
            )}

            {/* ── UPI form ──────────────────────────────────────────────── */}
            {tab === 'upi' && (
              <div className="rzp-modal__form">
                <div className="rzp-modal__test-hint">
                  <span className="rzp-modal__test-badge">TEST</span>
                  <span><strong>success@razorpay</strong> → succeeds · <strong>failure@razorpay</strong> → fails</span>
                </div>
                <div className="rzp-modal__field">
                  <label className="rzp-modal__label">UPI ID</label>
                  <input className="rzp-modal__input rzp-modal__input--upi" placeholder="yourname@upi"
                    value={upiId}
                    onChange={e => { setUpiId(e.target.value); setError(''); }} />
                </div>
                <div className="rzp-modal__upi-shortcuts">
                  {['@okicici', '@oksbi', '@ybl', '@paytm', '@apl'].map(s => (
                    <button key={s} className="rzp-modal__upi-chip"
                      onClick={() => { setUpiId((upiId.split('@')[0] || 'user') + s); setError(''); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Net Banking ───────────────────────────────────────────── */}
            {tab === 'netbanking' && (
              <div className="rzp-modal__form">
                <div className="rzp-modal__test-hint">
                  <span className="rzp-modal__test-badge">TEST</span>
                  <span>Select any bank — all succeed in sandbox mode</span>
                </div>
                <div className="rzp-modal__bank-grid">
                  {BANKS.map(b => (
                    <button key={b.id}
                      className={`rzp-modal__bank-tile ${bank === b.id ? 'rzp-modal__bank-tile--active' : ''}`}
                      onClick={() => { setBank(b.id); setError(''); }}>
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="rzp-modal__err rzp-modal__err--form">{error}</p>}

            <button className="rzp-modal__pay-btn" onClick={handlePay}>
              Pay ₹{parsed.toLocaleString('en-IN')}
            </button>
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="rzp-modal__footer">
          <span className="rzp-modal__footer-text">Powered by</span>
          <RazorpayLogo height={14} />
          <span className="rzp-modal__footer-sep">·</span>
          <span className="rzp-modal__footer-text">Test Mode</span>
        </div>

      </div>
    </div>
  );
};

export default PaymentOverlay;
