import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './DemoSection.css';

const DemoSection = () => {
  const sectionRef = useRef(null);
  const headerRef = useRef(null);
  const videoWrapRef = useRef(null);
  const videoRef = useRef(null);

  // GSAP scroll-reveal animation
  useEffect(() => {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const tl = gsap.timeline();
            tl.fromTo(
              headerRef.current,
              { opacity: 0, y: 40 },
              { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
            );
            tl.fromTo(
              videoWrapRef.current,
              { opacity: 0, y: 50, scale: 0.97 },
              { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out' },
              '-=0.3'
            );
            revealObserver.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) revealObserver.observe(sectionRef.current);
    return () => revealObserver.disconnect();
  }, []);

  // Autoplay when video is ≥50% in viewport, pause when it leaves
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {
              // Browser may block autoplay without mute; try muted then play
              video.muted = true;
              video.play().catch(() => {});
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );

    playObserver.observe(video);
    return () => playObserver.disconnect();
  }, []);

  return (
    <section className="demo" id="demo" ref={sectionRef}>
      <div className="demo__inner">
        <div className="demo__header" ref={headerRef}>
          <span className="demo__label">Live Demo</span>
          <h2 className="demo__title">
            See <span className="demo__title-accent">FinAlly</span> in Action
          </h2>
          <p className="demo__subtitle">
            Watch how our AI agent handles trading, charts, investment analysis, and more — all from natural language.
          </p>
        </div>

        <div className="demo__video-wrap" ref={videoWrapRef}>
          <div className="demo__video-glow" />
          <video
            ref={videoRef}
            className="demo__video"
            src="/Video Project.mp4"
            controls
            playsInline
            loop
            preload="metadata"
          />
          <div className="demo__video-border" />
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
