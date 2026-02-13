import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import './Preloader.css';

const Preloader = ({ onComplete }) => {
  const preloaderRef = useRef(null);
  const logoRef = useRef(null);
  const lineRef = useRef(null);
  const counterRef = useRef(null);
  const overlayTopRef = useRef(null);
  const overlayBottomRef = useRef(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => {
        if (onComplete) onComplete();
      },
    });

    const counter = { val: 0 };
    tl.to(counter, {
      val: 100,
      duration: 2,
      ease: 'power2.inOut',
      onUpdate: () => setCount(Math.round(counter.val)),
    });

    tl.fromTo(
      lineRef.current,
      { scaleX: 0 },
      { scaleX: 1, duration: 2, ease: 'power2.inOut' },
      0
    );

    tl.fromTo(
      logoRef.current,
      { opacity: 0, y: 20, scale: 0.9 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'power3.out' },
      0.3
    );

    tl.to({}, { duration: 0.3 });

    tl.to(logoRef.current, {
      scale: 1.1,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
    });

    tl.to(counterRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
    }, '-=0.4');

    tl.to(lineRef.current, {
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
    }, '-=0.3');

    tl.to(overlayTopRef.current, {
      yPercent: -100,
      duration: 0.8,
      ease: 'power4.inOut',
    });

    tl.to(
      overlayBottomRef.current,
      {
        yPercent: 100,
        duration: 0.8,
        ease: 'power4.inOut',
      },
      '-=0.8'
    );

    return () => tl.kill();
  }, [onComplete]);

  return (
    <div className="preloader" ref={preloaderRef}>
      <div className="preloader-overlay-top" ref={overlayTopRef}>
        <div className="preloader-inner">
          <div className="preloader-logo" ref={logoRef}>
            <span className="preloader-fin">Fin</span>
            <span className="preloader-ally">Ally</span>
            <span className="preloader-bytestorm">a ByteStorm Creation</span>
          </div>
          <div className="preloader-line" ref={lineRef} />
          <div className="preloader-counter" ref={counterRef}>
            {count}
          </div>
        </div>
      </div>
      <div className="preloader-overlay-bottom" ref={overlayBottomRef} />
    </div>
  );
};

export default Preloader;
