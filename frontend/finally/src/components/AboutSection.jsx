import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './AboutSection.css';

const AboutSection = () => {
  const sectionRef = useRef(null);
  const contentRef = useRef(null);
  const statsRef = useRef([]);
  const timelineBarRef = useRef([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const tl = gsap.timeline();
            tl.fromTo(
              contentRef.current,
              { opacity: 0, y: 50 },
              { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
            );
            tl.fromTo(
              statsRef.current.filter(Boolean),
              { opacity: 0, y: 30 },
              { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.12 },
              '-=0.4'
            );
            tl.fromTo(
              timelineBarRef.current.filter(Boolean),
              { scaleX: 0 },
              { scaleX: 1, duration: 0.8, ease: 'power2.out', stagger: 0.15 },
              '-=0.3'
            );
            observer.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const techStack = [
    { label: 'AI Agent', detail: 'Gemini + LangChain' },
    { label: 'Backend', detail: 'FastAPI + Python' },
    { label: 'Frontend', detail: 'React + Three.js' },
    { label: 'Data', detail: 'yFinance + Web Scraping' },
  ];

  return (
    <section className="about" id="about" ref={sectionRef}>
      <div className="about__inner" ref={contentRef}>
        <div className="about__left">
          <h2 className="about__title">
            Built by{' '}
            <span className="about__title-accent">ByteStorm</span>
          </h2>
          <p className="about__desc">
            FinAlly is an AI-powered financial assistant that combines real-time
            market intelligence with conversational AI. We built it to democratize
            financial literacy — making professional-grade insights accessible to
            everyone.
          </p>
          <p className="about__desc about__desc--secondary">
            From stock analysis and SIP planning to fraud detection and curated
            news, FinAlly is your all-in-one financial companion. Our agent
            understands context, remembers conversations, and provides
            actionable insights.
          </p>

          <div className="about__mission">
            <span className="about__mission-line" />
            <p className="about__mission-text">
              &ldquo;Making intelligent finance accessible to everyone, everywhere.&rdquo;
            </p>
          </div>
        </div>

        <div className="about__right">
          <div className="about__techstack">
            <h3 className="about__techstack-title">Tech Stack</h3>
            {techStack.map((item, i) => (
              <div
                key={item.label}
                className="about__tech-item cursor-target"
                ref={(el) => (statsRef.current[i] = el)}
              >
                <span className="about__tech-label">{item.label}</span>
                <div
                  className="about__tech-bar"
                  ref={(el) => (timelineBarRef.current[i] = el)}
                />
                <span className="about__tech-detail">{item.detail}</span>
              </div>
            ))}
          </div>

          <div className="about__stats-grid">
            <div
              className="about__stat cursor-target"
              ref={(el) => (statsRef.current[techStack.length] = el)}
            >
              <span className="about__stat-value">6+</span>
              <span className="about__stat-label">Core Features</span>
            </div>
            <div
              className="about__stat cursor-target"
              ref={(el) => (statsRef.current[techStack.length + 1] = el)}
            >
              <span className="about__stat-value">AI</span>
              <span className="about__stat-label">Powered Agent</span>
            </div>
            <div
              className="about__stat cursor-target"
              ref={(el) => (statsRef.current[techStack.length + 2] = el)}
            >
              <span className="about__stat-value">Live</span>
              <span className="about__stat-label">Market Feed</span>
            </div>
            <div
              className="about__stat cursor-target"
              ref={(el) => (statsRef.current[techStack.length + 3] = el)}
            >
              <span className="about__stat-value">24/7</span>
              <span className="about__stat-label">Availability</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
