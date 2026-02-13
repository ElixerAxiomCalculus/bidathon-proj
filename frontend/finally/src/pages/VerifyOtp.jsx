import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import { verifyOtp, resendOtp } from '../services/api';
import './VerifyOtp.css';

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const inputsRef = useRef([]);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!email) {
      navigate('/login', { replace: true });
    }
  }, [email, navigate]);

  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 30, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' }
    );
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;

    const next = [...otp];
    next[index] = value;
    setOtp(next);

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || '';
    }
    setOtp(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await verifyOtp(email, code);
      setSuccess('Verified! Redirecting...');
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err) {
      setError(err.message || 'Invalid OTP');
      setOtp(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    try {
      await resendOtp(email);
      setSuccess('New OTP sent! Check your email.');
      setCooldown(30);
    } catch (err) {
      setError(err.message || 'Failed to resend');
    }
  };

  if (!email) return null;

  return (
    <div className="otp-page">
      <div className="otp-card" ref={cardRef}>
        <h1 className="otp-card__title">Verify Your Email</h1>
        <p className="otp-card__desc">
          We sent a 6-digit code to{' '}
          <span className="otp-card__email">{email}</span>
          <br />
          Please check your inbox (and spam folder).
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem' }}>
          <div className="otp-inputs" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => (inputsRef.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                autoFocus={i === 0}
              />
            ))}
          </div>

          {error && <div className="otp-error">{error}</div>}
          {success && <div className="otp-success">{success}</div>}

          <button className="otp-submit" type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <p className="otp-resend">
          Didn&apos;t receive a code?
          <button onClick={handleResend} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
          </button>
        </p>

        <a
          href="/login"
          className="otp-back"
          onClick={(e) => {
            e.preventDefault();
            navigate('/login');
          }}
        >
          &larr; Back to Login
        </a>
      </div>
    </div>
  );
};

export default VerifyOtp;
