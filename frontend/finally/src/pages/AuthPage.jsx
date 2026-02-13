import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import { signup, login } from '../services/api';

// ... (keep unused imports if needed or remove them. login is no longer needed)

// ...


import Preloader from '../components/Preloader';
import './AuthPage.css';

const GraphicPanel = ({ focusState }) => {
  const canvasRef = useRef(null);
  const nodesRef = useRef([]);
  const animFrameRef = useRef(null);
  const focusRef = useRef(focusState);

  useEffect(() => {
    focusRef.current = focusState;
  }, [focusState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const count = 40;
    const nodes = Array.from({ length: count }, () => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        baseRadius: Math.random() * 2 + 1,
        radius: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2,
      };
    });
    nodesRef.current = nodes;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      const focus = focusRef.current;
      const time = Date.now() * 0.001;

      const intensityMap = { idle: 0.3, email: 0.5, password: 0.8, name: 0.6, confirm: 0.9 };
      const intensity = intensityMap[focus] || 0.3;

      nodes.forEach((node) => {
        node.x += node.vx * (1 + intensity);
        node.y += node.vy * (1 + intensity);

        if (node.x < 0 || node.x > w) node.vx *= -1;
        if (node.y < 0 || node.y > h) node.vy *= -1;
        node.x = Math.max(0, Math.min(w, node.x));
        node.y = Math.max(0, Math.min(h, node.y));

        node.radius = Math.max(0.1, node.baseRadius + Math.sin(time * 2 + node.phase) * intensity * 1.5);
      });

      const connectionDist = 120 + intensity * 60;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * intensity * 0.6;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(4, 102, 200, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      nodes.forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(4, 102, 200, ${0.3 + intensity * 0.5})`;
        ctx.fill();
      });

      if (intensity > 0.4) {
        const cx = w / 2;
        const cy = h / 2;
        const pulseRadius = 60 + Math.sin(time * 3) * 20 * intensity;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(4, 102, 200, ${intensity * 0.15})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, pulseRadius * 1.4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(4, 102, 200, ${intensity * 0.08})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div className="auth-graphic">
      <canvas ref={canvasRef} className="auth-graphic__canvas" />
      <div className="auth-graphic__content">
        <h2 className="auth-graphic__title">
          <span className="auth-graphic__fin">Fin</span>
          <span className="auth-graphic__ally">Ally</span>
        </h2>
        <p className="auth-graphic__bytestorm">a ByteStorm Creation</p>
        <p className="auth-graphic__subtitle">
          Intelligence meets finance
        </p>
        <div className="auth-graphic__stats">
          <div className="auth-graphic__stat">
            <span className="auth-graphic__stat-value">24/7</span>
            <span className="auth-graphic__stat-label">AI Analysis</span>
          </div>
          <span className="auth-graphic__stat-divider" />
          <div className="auth-graphic__stat">
            <span className="auth-graphic__stat-value">Real-time</span>
            <span className="auth-graphic__stat-label">Market Data</span>
          </div>
          <span className="auth-graphic__stat-divider" />
          <div className="auth-graphic__stat">
            <span className="auth-graphic__stat-value">Smart</span>
            <span className="auth-graphic__stat-label">Insights</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const AuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isSignUp = location.pathname === '/signin';

  const [preloaderDone, setPreloaderDone] = useState(false);
  const [focusState, setFocusState] = useState('idle');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formRef = useRef(null);
  const fieldsRef = useRef([]);

  useEffect(() => {
    if (!formRef.current) return;
    const tl = gsap.timeline();

    tl.fromTo(
      formRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
    );

    tl.fromTo(
      fieldsRef.current.filter(Boolean),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', stagger: 0.08 },
      '-=0.3'
    );

    return () => tl.kill();
  }, [isSignUp]);

  const handleChange = useCallback((e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp) {
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (!formData.phone.trim()) {
        setError('Phone number is required');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        await signup(formData.name, formData.email, formData.phone, formData.password);
        navigate('/verify', { state: { email: formData.email } });
      } else {
        const data = await login(formData.email, formData.password);
        if (data.token) {
          navigate('/dashboard');
        } else {
          // OTP sent for 2FA verification
          navigate('/verify', { state: { email: formData.email } });
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}
      <GraphicPanel focusState={focusState} />

      <div className="auth-form-panel">
        <div className="auth-form-wrapper" ref={formRef}>
          <a
            href="/"
            className="auth-back"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            &larr; Back
          </a>

          <div className="auth-form-header">
            <h1 className="auth-form-title">
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="auth-form-desc">
              {isSignUp
                ? 'Start your financial journey with FinAlly'
                : 'Sign in to continue with FinAlly'}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && <div className="auth-error">{error}</div>}

            {isSignUp && (
              <div
                className="auth-field"
                ref={(el) => (fieldsRef.current[0] = el)}
              >
                <label className="auth-label" htmlFor="name">
                  Full Name
                </label>
                <input
                  className="auth-input"
                  type="text"
                  id="name"
                  name="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  onFocus={() => setFocusState('name')}
                  onBlur={() => setFocusState('idle')}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            {isSignUp && (
              <div
                className="auth-field"
                ref={(el) => (fieldsRef.current[1] = el)}
              >
                <label className="auth-label" htmlFor="phone">
                  Phone Number
                </label>
                <input
                  className="auth-input"
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={handleChange}
                  onFocus={() => setFocusState('name')}
                  onBlur={() => setFocusState('idle')}
                  autoComplete="tel"
                  required
                />
              </div>
            )}

            <div
              className="auth-field"
              ref={(el) => (fieldsRef.current[isSignUp ? 2 : 0] = el)}
            >
              <label className="auth-label" htmlFor="email">
                Email
              </label>
              <input
                className="auth-input"
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                onFocus={() => setFocusState('email')}
                onBlur={() => setFocusState('idle')}
                autoComplete="email"
              />
            </div>

            <div
              className="auth-field"
              ref={(el) => (fieldsRef.current[isSignUp ? 3 : 1] = el)}
            >
              <label className="auth-label" htmlFor="password">
                Password
              </label>
              <input
                className="auth-input"
                type="password"
                id="password"
                name="password"
                placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                value={formData.password}
                onChange={handleChange}
                onFocus={() => setFocusState('password')}
                onBlur={() => setFocusState('idle')}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {isSignUp && (
              <div
                className="auth-field"
                ref={(el) => (fieldsRef.current[4] = el)}
              >
                <label className="auth-label" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  className="auth-input"
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onFocus={() => setFocusState('confirm')}
                  onBlur={() => setFocusState('idle')}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? (isSignUp ? 'Creating Account...' : 'Signing In...')
                : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="auth-divider">
            <span className="auth-divider-line" />
            <span className="auth-divider-text">or</span>
            <span className="auth-divider-line" />
          </div>

          <p className="auth-switch">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <a
                  href="/login"
                  className="auth-switch-link"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/login');
                  }}
                >
                  Log In
                </a>
              </>
            ) : (
              <>
                Don&apos;t have an account?{' '}
                <a
                  href="/signin"
                  className="auth-switch-link"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/signin');
                  }}
                >
                  Sign Up
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
