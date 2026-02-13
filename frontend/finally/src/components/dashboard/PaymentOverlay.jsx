import { useState, useRef, useEffect } from 'react';
import './PaymentOverlay.css';

const PRESET_AMOUNTS = [1000, 5000, 10000, 25000, 50000, 100000];
const BANKS = ['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra', 'PNB', 'Bank of Baroda', 'Yes Bank'];

const PaymentOverlay = ({ isOpen, onClose, onSuccess, currentBalance }) => {
  const [step, setStep] = useState('amount');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(null);
  const [cardData, setCardData] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [upiId, setUpiId] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const overlayRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setStep('amount');
      setAmount('');
      setMethod(null);
      setCardData({ number: '', expiry: '', cvv: '', name: '' });
      setUpiId('');
      setSelectedBank('');
      setProcessing(false);
      setSuccess(false);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const parsedAmount = parseFloat(amount) || 0;

  const handleAmountNext = () => {
    if (parsedAmount < 100) { setError('Minimum amount is ₹100'); return; }
    if (parsedAmount > 100_000_000) { setError('Maximum amount is ₹10 Cr'); return; }
    setError('');
    setStep('method');
  };

  const handleMethodSelect = (m) => {
    setMethod(m);
    setStep('details');
  };

  const formatCardNumber = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length > 2) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const handlePay = async () => {
    setError('');
    if (method === 'card') {
      const num = cardData.number.replace(/\s/g, '');
      if (num.length < 16) { setError('Enter a valid 16-digit card number'); return; }
      if (cardData.expiry.length < 5) { setError('Enter valid expiry MM/YY'); return; }
      if (cardData.cvv.length < 3) { setError('Enter valid CVV'); return; }
      if (!cardData.name.trim()) { setError('Enter cardholder name'); return; }
    } else if (method === 'upi') {
      if (!upiId.includes('@')) { setError('Enter a valid UPI ID (e.g. name@upi)'); return; }
    } else if (method === 'netbanking') {
      if (!selectedBank) { setError('Select a bank'); return; }
    }

    setProcessing(true);
    await new Promise((r) => setTimeout(r, 2000));

    try {
      await onSuccess(parsedAmount);
      setProcessing(false);
      setSuccess(true);
    } catch (err) {
      setProcessing(false);
      setError(err.message || 'Payment failed');
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="payment-overlay" ref={overlayRef} onClick={handleBackdropClick}>
      <div className="payment-modal">
        <div className="payment-modal__header">
          <div className="payment-modal__header-left">
            <div className="payment-modal__logo">
              <span className="payment-modal__logo-fin">Fin</span>
              <span className="payment-modal__logo-ally">Ally</span>
            </div>
            <span className="payment-modal__header-label">Add Funds</span>
          </div>
          <button className="payment-modal__close" onClick={onClose}>&times;</button>
        </div>

        {success ? (
          <div className="payment-modal__success">
            <div className="payment-modal__success-icon">
              <div className="payment-modal__checkmark-text">[SUCCESS]</div>
            </div>
            <h3 className="payment-modal__success-title">Payment Successful</h3>
            <p className="payment-modal__success-amount">₹{parsedAmount.toLocaleString('en-IN')}</p>
            <p className="payment-modal__success-text">Added to your FinAlly wallet</p>
            <button className="payment-modal__success-btn" onClick={onClose}>Done</button>
          </div>
        ) : processing ? (
          <div className="payment-modal__processing">
            <div className="payment-modal__spinner" />
            <p className="payment-modal__processing-text">Processing payment...</p>
            <p className="payment-modal__processing-sub">Please do not close this window</p>
          </div>
        ) : (
          <>
            <div className="payment-modal__steps">
              <div className={`payment-modal__step ${step === 'amount' ? 'payment-modal__step--active' : (step !== 'amount' ? 'payment-modal__step--done' : '')}`}>
                <span className="payment-modal__step-num">1</span>
                <span className="payment-modal__step-label">Amount</span>
              </div>
              <div className="payment-modal__step-line" />
              <div className={`payment-modal__step ${step === 'method' ? 'payment-modal__step--active' : (step === 'details' ? 'payment-modal__step--done' : '')}`}>
                <span className="payment-modal__step-num">2</span>
                <span className="payment-modal__step-label">Method</span>
              </div>
              <div className="payment-modal__step-line" />
              <div className={`payment-modal__step ${step === 'details' ? 'payment-modal__step--active' : ''}`}>
                <span className="payment-modal__step-num">3</span>
                <span className="payment-modal__step-label">Pay</span>
              </div>
            </div>

            <div className="payment-modal__body">
              {step === 'amount' && (
                <div className="payment-modal__amount-step">
                  <div className="payment-modal__balance-display">
                    <span className="payment-modal__balance-label">Current Balance</span>
                    <span className="payment-modal__balance-value">₹{(currentBalance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>

                  <label className="payment-modal__field-label">Enter Amount</label>
                  <div className="payment-modal__amount-input-wrap">
                    <span className="payment-modal__currency">₹</span>
                    <input
                      type="number"
                      className="payment-modal__amount-input"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => { setAmount(e.target.value); setError(''); }}
                      autoFocus
                    />
                  </div>

                  <div className="payment-modal__presets">
                    {PRESET_AMOUNTS.map((a) => (
                      <button
                        key={a}
                        className={`payment-modal__preset ${parsedAmount === a ? 'payment-modal__preset--active' : ''}`}
                        onClick={() => { setAmount(String(a)); setError(''); }}
                      >
                        ₹{a.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>

                  {error && <p className="payment-modal__error">{error}</p>}

                  <button
                    className="payment-modal__primary-btn"
                    disabled={!parsedAmount}
                    onClick={handleAmountNext}
                  >
                    Continue
                  </button>
                </div>
              )}

              {step === 'method' && (
                <div className="payment-modal__method-step">
                  <div className="payment-modal__amount-summary">
                    <span>Adding</span>
                    <strong>₹{parsedAmount.toLocaleString('en-IN')}</strong>
                    <button className="payment-modal__edit-btn" onClick={() => setStep('amount')}>Edit</button>
                  </div>

                  <label className="payment-modal__field-label">Select Payment Method</label>

                  <button className="payment-modal__method-card" onClick={() => handleMethodSelect('card')}>
                    <div className="payment-modal__method-info">
                      <span className="payment-modal__method-name">Credit / Debit Card</span>
                      <span className="payment-modal__method-desc">Visa, Mastercard, RuPay</span>
                    </div>
                    <span className="payment-modal__method-arrow">&#8250;</span>
                  </button>

                  <button className="payment-modal__method-card" onClick={() => handleMethodSelect('upi')}>
                    <div className="payment-modal__method-info">
                      <span className="payment-modal__method-name">UPI</span>
                      <span className="payment-modal__method-desc">Google Pay, PhonePe, Paytm</span>
                    </div>
                    <span className="payment-modal__method-arrow">&#8250;</span>
                  </button>

                  <button className="payment-modal__method-card" onClick={() => handleMethodSelect('netbanking')}>
                    <div className="payment-modal__method-info">
                      <span className="payment-modal__method-name">Net Banking</span>
                      <span className="payment-modal__method-desc">All major Indian banks</span>
                    </div>
                    <span className="payment-modal__method-arrow">&#8250;</span>
                  </button>
                </div>
              )}

              {step === 'details' && (
                <div className="payment-modal__details-step">
                  <div className="payment-modal__amount-summary">
                    <span>Paying</span>
                    <strong>₹{parsedAmount.toLocaleString('en-IN')}</strong>
                    <span className="payment-modal__method-tag">
                      {method === 'card' ? 'Card' : method === 'upi' ? 'UPI' : 'NetBanking'}
                    </span>
                  </div>

                  {method === 'card' && (
                    <div className="payment-modal__card-form">
                      <div className="payment-modal__field">
                        <label className="payment-modal__field-label">Card Number</label>
                        <input
                          className="payment-modal__input"
                          placeholder="1234 5678 9012 3456"
                          value={cardData.number}
                          onChange={(e) => setCardData({ ...cardData, number: formatCardNumber(e.target.value) })}
                          maxLength={19}
                        />
                      </div>
                      <div className="payment-modal__field-row">
                        <div className="payment-modal__field">
                          <label className="payment-modal__field-label">Expiry</label>
                          <input
                            className="payment-modal__input"
                            placeholder="MM/YY"
                            value={cardData.expiry}
                            onChange={(e) => setCardData({ ...cardData, expiry: formatExpiry(e.target.value) })}
                            maxLength={5}
                          />
                        </div>
                        <div className="payment-modal__field">
                          <label className="payment-modal__field-label">CVV</label>
                          <input
                            className="payment-modal__input"
                            type="password"
                            placeholder="•••"
                            value={cardData.cvv}
                            onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                            maxLength={4}
                          />
                        </div>
                      </div>
                      <div className="payment-modal__field">
                        <label className="payment-modal__field-label">Cardholder Name</label>
                        <input
                          className="payment-modal__input"
                          placeholder="Name on card"
                          value={cardData.name}
                          onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {method === 'upi' && (
                    <div className="payment-modal__upi-form">
                      <div className="payment-modal__field">
                        <label className="payment-modal__field-label">UPI ID</label>
                        <input
                          className="payment-modal__input"
                          placeholder="yourname@upi"
                          value={upiId}
                          onChange={(e) => { setUpiId(e.target.value); setError(''); }}
                        />
                      </div>
                      <div className="payment-modal__upi-apps">
                        <span className="payment-modal__upi-hint">Popular: </span>
                        {['@okicici', '@oksbi', '@ybl', '@paytm', '@apl'].map((suffix) => (
                          <button
                            key={suffix}
                            className="payment-modal__upi-tag"
                            onClick={() => {
                              const name = upiId.split('@')[0] || 'user';
                              setUpiId(name + suffix);
                              setError('');
                            }}
                          >
                            {suffix}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {method === 'netbanking' && (
                    <div className="payment-modal__nb-form">
                      <label className="payment-modal__field-label">Select Bank</label>
                      <div className="payment-modal__bank-grid">
                        {BANKS.map((bank) => (
                          <button
                            key={bank}
                            className={`payment-modal__bank-btn ${selectedBank === bank ? 'payment-modal__bank-btn--active' : ''}`}
                            onClick={() => { setSelectedBank(bank); setError(''); }}
                          >
                            {bank}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && <p className="payment-modal__error">{error}</p>}

                  <div className="payment-modal__pay-actions">
                    <button className="payment-modal__back-btn" onClick={() => setStep('method')}>
                      &#8249; Back
                    </button>
                    <button className="payment-modal__pay-btn" onClick={handlePay}>
                      Pay ₹{parsedAmount.toLocaleString('en-IN')}
                    </button>
                  </div>

                  <div className="payment-modal__secure">
                    <span className="payment-modal__secure-icon">[LOCK]</span>
                    <span>Secured by FinAlly &middot; 256-bit SSL encrypted</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentOverlay;
