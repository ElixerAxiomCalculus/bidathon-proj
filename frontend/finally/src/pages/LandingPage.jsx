import { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import Preloader from '../components/Preloader';
import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import FeaturesSection from '../components/FeaturesSection';
import AboutSection from '../components/AboutSection';
import Footer from '../components/Footer';
import TargetCursor from '../components/TargetCursor';
import './LandingPage.css';

const LandingPage = () => {
  const [preloaderDone, setPreloaderDone] = useState(false);
  const lenisRef = useRef(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    const handleAnchorClick = (e) => {
      const anchor = e.target.closest('a[href^="#"]');
      if (!anchor) return;
      const target = anchor.getAttribute('href');
      const el = document.querySelector(target);
      if (el) {
        e.preventDefault();
        lenis.scrollTo(el, { offset: 0 });
      }
    };
    document.addEventListener('click', handleAnchorClick);

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="landing-page">
      {!preloaderDone && <Preloader onComplete={() => setPreloaderDone(true)} />}
      <TargetCursor />
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <AboutSection />
      <Footer />
    </div>
  );
};

export default LandingPage;
