import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <div className="footer__brand">
            <div className="footer__logo">
              <span className="footer__logo-fin">Fin</span>
              <span className="footer__logo-ally">Ally</span>
            </div>
            <p className="footer__bytestorm">a ByteStorm Creation</p>
            <p className="footer__tagline">
              Your Intelligent Financial Companion
            </p>
          </div>

          <div className="footer__links-group">
            <h4 className="footer__links-title">Product</h4>
            <a href="#features" className="footer__link">Features</a>
            <a href="#about" className="footer__link">About</a>
            <a href="/signin" className="footer__link">Sign Up</a>
            <a href="/login" className="footer__link">Log In</a>
          </div>


        </div>

        <div className="footer__divider" />

        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; {currentYear} FinAlly. Built with purpose by ByteStorm.
          </p>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
