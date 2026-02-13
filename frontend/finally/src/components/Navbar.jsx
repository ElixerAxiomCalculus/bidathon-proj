import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { gsap } from 'gsap';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);
  const menuRef = useRef(null);
  const linksRef = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (e, href) => {
    e.preventDefault();
    if (href === '/') {
      if (location.pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
      }
    } else if (href.startsWith('#')) {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      gsap.fromTo(
        menuRef.current,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
      );
      gsap.fromTo(
        linksRef.current.filter(Boolean),
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, ease: 'power3.out', stagger: 0.06, delay: 0.1 }
      );
    }
  }, [isOpen]);

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Features', href: '#features' },
    { label: 'About', href: '#about' },
  ];

  return (
    <nav
      ref={navRef}
      className={`navbar ${scrolled ? 'navbar--scrolled' : ''} ${isOpen ? 'navbar--open' : ''}`}
    >
      <div className="navbar__inner">
        <a href="/" className="navbar__logo" onClick={(e) => handleNavClick(e, '/')}>
          <span className="navbar__logo-fin">Fin</span>
          <span className="navbar__logo-ally">Ally</span>
          <span className="navbar__logo-bytestorm">, a ByteStorm Creation</span>
        </a>

        <div className="navbar__links-desktop">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="navbar__link"
              onClick={(e) => handleNavClick(e, link.href)}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="navbar__actions">
          <button
            className="navbar__btn navbar__btn--ghost"
            onClick={() => navigate('/signin')}
          >
            Sign Up
          </button>
          <button
            className="navbar__btn navbar__btn--primary"
            onClick={() => navigate('/login')}
          >
            Log In
          </button>
        </div>

        <button
          className={`navbar__hamburger ${isOpen ? 'navbar__hamburger--open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
          <span className="navbar__hamburger-line" />
          <span className="navbar__hamburger-line" />
        </button>
      </div>

      {isOpen && (
        <div className="navbar__mobile-menu" ref={menuRef}>
          {navLinks.map((link, i) => (
            <a
              key={link.label}
              href={link.href}
              className="navbar__mobile-link"
              ref={(el) => (linksRef.current[i] = el)}
              onClick={(e) => { handleNavClick(e, link.href); setIsOpen(false); }}
            >
              {link.label}
            </a>
          ))}
          <div className="navbar__mobile-actions">
            <button
              className="navbar__btn navbar__btn--ghost"
              ref={(el) => (linksRef.current[navLinks.length] = el)}
              onClick={() => { setIsOpen(false); navigate('/signin'); }}
            >
              Sign Up
            </button>
            <button
              className="navbar__btn navbar__btn--primary"
              ref={(el) => (linksRef.current[navLinks.length + 1] = el)}
              onClick={() => { setIsOpen(false); navigate('/login'); }}
            >
              Log In
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
