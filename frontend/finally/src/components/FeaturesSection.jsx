import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './FeaturesSection.css';

const features = [
  {
    number: '01',
    title: 'AI Financial Agent',
    description:
      'Ask anything about markets, mutual funds, or investing. Our AI agent understands finance deeply and answers in real-time with contextual intelligence.',
    accent: '#0466C8',
  },
  {
    number: '02',
    title: 'Real-Time Market Data',
    description:
      'Live stock quotes, historical trends, and market analysis powered by yFinance. Track any ticker with instant, up-to-date information.',
    accent: '#0477e0',
  },
  {
    number: '03',
    title: 'Financial Calculators',
    description:
      'SIP, EMI, and compound interest calculators built in. Plan your investments and loans with precision — all in one place.',
    accent: '#0488f8',
  },
  {
    number: '04',
    title: 'Fraud URL Detection',
    description:
      'Paste any financial URL and we verify it against known fraud databases. Protect yourself from phishing, scams, and fake finance sites.',
    accent: '#0353a4',
  },
  {
    number: '05',
    title: 'Smart Web Scraping',
    description:
      'Curated financial news and articles scraped and summarized. Stay informed without the noise — only the insights that matter.',
    accent: '#023e7d',
  },
  {
    number: '06',
    title: 'Conversational Memory',
    description:
      'Your agent remembers context across conversations. No repetition needed — it builds on prior interactions for a seamless experience.',
    accent: '#002855',
  },
];

const FeaturesSection = () => {
  const sectionRef = useRef(null);
  const cardsRef = useRef([]);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const tl = gsap.timeline();
            tl.fromTo(
              titleRef.current,
              { opacity: 0, y: 40 },
              { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' }
            );
            tl.fromTo(
              subtitleRef.current,
              { opacity: 0, y: 20 },
              { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
              '-=0.4'
            );
            tl.fromTo(
              cardsRef.current.filter(Boolean),
              { opacity: 0, y: 50 },
              {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: 'power3.out',
                stagger: 0.1,
              },
              '-=0.3'
            );
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="features" id="features" ref={sectionRef}>
      <div className="features__inner">
        <div className="features__header">
          <h2 className="features__title" ref={titleRef}>
            What Powers <span className="features__title-accent">FinAlly</span>
          </h2>
          <p className="features__subtitle" ref={subtitleRef}>
            A comprehensive suite of AI-driven financial tools,
            designed to empower smarter decisions.
          </p>
        </div>

        <div className="features__grid">
          {features.map((f, i) => (
            <div
              key={f.number}
              className="features__card cursor-target"
              ref={(el) => (cardsRef.current[i] = el)}
            >
              <div
                className="features__card-accent"
                style={{ background: f.accent }}
              />
              <span className="features__card-number">{f.number}</span>
              <h3 className="features__card-title">{f.title}</h3>
              <p className="features__card-desc">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
