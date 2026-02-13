import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import ThreeBackground from './ThreeBackground';
import './HeroSection.css';

const HeroSection = () => {
  const heroRef = useRef(null);
  const logoFinRef = useRef(null);
  const logoAllyRef = useRef(null);
  const taglineRef = useRef(null);
  const subtextRef = useRef(null);
  const ctaRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ delay: 3.2 });

    tl.fromTo(
      logoFinRef.current,
      { opacity: 0, x: -60 },
      { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' },
      0.3
    );

    tl.fromTo(
      logoAllyRef.current,
      { opacity: 0, x: 60 },
      { opacity: 1, x: 0, duration: 0.8, ease: 'power3.out' },
      0.3
    );

    tl.fromTo(
      taglineRef.current,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      0.8
    );

    tl.fromTo(
      subtextRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
      1.0
    );

    tl.fromTo(
      ctaRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' },
      1.2
    );

    return () => tl.kill();
  }, []);

  return (
    <section className="hero" ref={heroRef}>
      <ThreeBackground />

      <div className="hero__content">
        <h1 className="hero__logo cursor-target">
          <span className="hero__logo-fin" ref={logoFinRef}>Fin</span>
          <span className="hero__logo-ally" ref={logoAllyRef}>Ally</span>
        </h1>
        <span className="hero__bytestorm">a ByteStorm Creation</span>

        <p className="hero__tagline" ref={taglineRef}>
          Your Intelligent Financial Companion
        </p>

        <p className="hero__subtext" ref={subtextRef}>
          Navigate markets, decode trends, and build wealth
          <br className="hero__br-desktop" />
          with AI-powered financial intelligence.
        </p>

        <div className="hero__cta" ref={ctaRef}>
          <a href="#features" className="hero__cta-btn hero__cta-btn--primary cursor-target">
            Explore
          </a>
          <a href="#about" className="hero__cta-btn hero__cta-btn--outline cursor-target">
            Learn More
          </a>
        </div>
      </div>

      <div className="hero__scroll-indicator">
        <div className="hero__scroll-line" />
      </div>
    </section>
  );
};

export default HeroSection;
