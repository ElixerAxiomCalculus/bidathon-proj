import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout as logoutApi, getWalletBalance } from '../../services/api';
import './DashboardNavbar.css';

const formatBalance = (n) => {
  if (n == null) return '—';
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const DashboardNavbar = ({ onToggleSidebar, onToggleMarket, sidebarOpen, marketPanelOpen, user, walletBalance, onAddMoney }) => {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [walletDropOpen, setWalletDropOpen] = useState(false);
  const profileRef = useRef(null);
  const walletRef = useRef(null);

  const userName = user?.name || 'User';
  const userEmail = user?.email || '';

  useEffect(() => {
    const handleClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (walletRef.current && !walletRef.current.contains(e.target)) {
        setWalletDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    logoutApi();
    navigate('/');
  };

  return (
    <header className="dash-nav">
      <div className="dash-nav__left">
        <button
          className="dash-nav__toggle"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <span className={`dash-nav__toggle-bar ${sidebarOpen ? 'dash-nav__toggle-bar--open' : ''}`} />
          <span className={`dash-nav__toggle-bar ${sidebarOpen ? 'dash-nav__toggle-bar--open' : ''}`} />
          <span className={`dash-nav__toggle-bar ${sidebarOpen ? 'dash-nav__toggle-bar--open' : ''}`} />
        </button>

        <a
          href="/"
          className="dash-nav__logo"
          onClick={(e) => { e.preventDefault(); navigate('/'); }}
        >
          <span className="dash-nav__logo-fin">Fin</span>
          <span className="dash-nav__logo-ally">Ally</span>
          <span className="dash-nav__logo-bytestorm">, a ByteStorm Creation</span>
        </a>
      </div>

      <div className="dash-nav__center">
        <span className="dash-nav__status-dot" />
        <span className="dash-nav__status-text">AI Agent Online</span>
      </div>

      <div className="dash-nav__right">
        <button
          className="dash-nav__market-toggle"
          onClick={onToggleMarket}
          title={marketPanelOpen ? 'Hide market data' : 'Show market data'}
        >
          {marketPanelOpen ? 'Hide Markets' : 'Markets'}
        </button>

        <div className="dash-nav__wallet-wrapper" ref={walletRef}>
          <button
            className={`dash-nav__wallet ${walletDropOpen ? 'dash-nav__wallet--active' : ''}`}
            onClick={() => setWalletDropOpen((p) => !p)}
          >
            <span className="dash-nav__wallet-label">Wallet</span>
            <span className="dash-nav__wallet-value">{formatBalance(walletBalance)}</span>
          </button>

          {walletDropOpen && (
            <div className="dash-nav__wallet-dropdown">
              <div className="dash-nav__wallet-dropdown-balance">
                <span className="dash-nav__wallet-dropdown-lbl">Available Balance</span>
                <span className="dash-nav__wallet-dropdown-amt">{formatBalance(walletBalance)}</span>
              </div>
              <div className="dash-nav__dropdown-divider" />
              <button
                className="dash-nav__dropdown-item dash-nav__dropdown-item--add"
                onClick={() => { setWalletDropOpen(false); onAddMoney && onAddMoney(); }}
              >
                + Add Money
              </button>
            </div>
          )}
        </div>

        <div className="dash-nav__profile-wrapper" ref={profileRef}>
          <button
            className={`dash-nav__profile ${profileOpen ? 'dash-nav__profile--active' : ''}`}
            onClick={() => setProfileOpen((p) => !p)}
          >
            <span className="dash-nav__profile-name">{userName.split(' ')[0]}</span>
            <span className="dash-nav__profile-arrow">{profileOpen ? '▴' : '▾'}</span>
          </button>

          {profileOpen && (
            <div className="dash-nav__dropdown">
              <div className="dash-nav__dropdown-header">
                <span className="dash-nav__dropdown-user">{userName}</span>
                <span className="dash-nav__dropdown-email">{userEmail}</span>
              </div>
              <div className="dash-nav__dropdown-divider" />
              <button
                className="dash-nav__dropdown-item"
                onClick={() => { setProfileOpen(false); navigate('/profile'); }}
              >
                Profile Settings
              </button>
              <button
                className="dash-nav__dropdown-item"
                onClick={() => { setProfileOpen(false); navigate('/quant-terminal'); }}
                style={{ color: '#7ec7ff', fontWeight: 700 }}
              >
                Quant Trading Terminal
              </button>
              <button
                className="dash-nav__dropdown-item"
                onClick={() => { setProfileOpen(false); navigate('/docs'); }}
              >
                Documentation
              </button>
              <button
                className="dash-nav__dropdown-item dash-nav__dropdown-item--logout"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default DashboardNavbar;
