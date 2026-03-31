import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { BLOG_POSTS, AUTHORS } from '../data/blogPosts';
import './LatestBlogsSection.css';

const LatestBlogsSection = () => {
  const sectionRef = useRef(null);
  const cardsRef = useRef([]);
  const navigate = useNavigate();

  // Get only the latest 3 posts
  const latestPosts = BLOG_POSTS.slice(0, 3);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            gsap.fromTo(
              cardsRef.current.filter(Boolean),
              { opacity: 0, y: 40 },
              {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.15,
                ease: 'power3.out',
              }
            );
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="latest-blogs" id="latest-blogs" ref={sectionRef}>
      <div className="latest-blogs__inner">
        <div className="latest-blogs__header">
          <h2 className="latest-blogs__title">Intelligence & Insights</h2>
          <p className="latest-blogs__subtitle">
            The latest thinking on AI, quant finance, and market trends from the FinAlly team.
          </p>
        </div>

        <div className="latest-blogs__grid">
          {latestPosts.map((post, i) => {
            const author = AUTHORS[post.author];
            return (
              <div
                key={post.id}
                className="latest-blogs__card"
                ref={(el) => (cardsRef.current[i] = el)}
                onClick={() => navigate(`/blog/${post.slug}`)}
              >
                <div 
                  className="latest-blogs__card-cover" 
                  style={{ background: post.coverGradient }}
                >
                  <div className="latest-blogs__card-tags">
                    {post.tags.slice(0, 2).map((tag, tIndex) => (
                      <span key={tIndex} className="latest-blogs__card-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="latest-blogs__card-content">
                  <h3 className="latest-blogs__card-title">{post.title}</h3>
                  <p className="latest-blogs__card-excerpt">
                    {post.excerpt.length > 100
                      ? post.excerpt.substring(0, 100) + '...'
                      : post.excerpt}
                  </p>

                  <div className="latest-blogs__card-footer">
                    <div className="latest-blogs__author">
                      <img 
                        src={author?.avatar} 
                        alt={author?.name} 
                        className="latest-blogs__author-img"
                      />
                      <div className="latest-blogs__author-info">
                        <span className="latest-blogs__author-name">{author?.name}</span>
                        <span className="latest-blogs__post-date">
                          {post.date} • {post.readTime}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="latest-blogs__cta">
          <button 
            className="latest-blogs__view-all"
            onClick={() => navigate('/blogs')}
          >
            Explore All Articles
          </button>
        </div>
      </div>
    </section>
  );
};

export default LatestBlogsSection;