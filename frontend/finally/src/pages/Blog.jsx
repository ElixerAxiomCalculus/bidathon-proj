import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { BLOG_POSTS, AUTHORS } from '../data/blogPosts';
import './Blog.css';

const BlogCard = ({ post, onClick }) => {
  const author = AUTHORS[post.author];
  return (
    <article className="blog-card cursor-target" onClick={onClick}>
      <div className="blog-card__cover" style={{ background: post.coverGradient }}>
        <div className="blog-card__cover-overlay" />
        <div className="blog-card__tags">
          {post.tags.slice(0, 3).map(tag => (
            <span key={tag} className="blog-card__tag">{tag}</span>
          ))}
        </div>
      </div>
      <div className="blog-card__body">
        <h2 className="blog-card__title">{post.title}</h2>
        <p className="blog-card__excerpt">{post.excerpt}</p>
        <div className="blog-card__meta">
          <div className="blog-card__author">
            <div className="blog-card__author-avatar">{author.avatar}</div>
            <div>
              <div className="blog-card__author-name">{author.name}</div>
              <div className="blog-card__author-role">{author.role}</div>
            </div>
          </div>
          <div className="blog-card__info">
            <span className="blog-card__date">{new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span className="blog-card__dot">·</span>
            <span className="blog-card__read-time">{post.readTime}</span>
          </div>
        </div>
      </div>
    </article>
  );
};

const Blog = () => {
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const tl = gsap.timeline({ delay: 0.1 });
    tl.fromTo(headerRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
    tl.fromTo(listRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3');
    return () => tl.kill();
  }, []);

  return (
    <div className="blog-page">
      <Navbar />

      <div className="blog-hero" ref={headerRef}>
        <div className="blog-hero__inner">
          <span className="blog-hero__label">From the Team</span>
          <h1 className="blog-hero__title">FinAlly Blog</h1>
          <p className="blog-hero__subtitle">
            Engineering deep-dives, product announcements, and honest conversations from the ByteStorm team building FinAlly.
          </p>
        </div>
      </div>

      <div className="blog-content">
        <div className="blog-content__inner" ref={listRef}>
          <div className="blog-list">
            {BLOG_POSTS.map(post => (
              <BlogCard
                key={post.slug}
                post={post}
                onClick={() => navigate(`/blog/${post.slug}`)}
              />
            ))}
          </div>

          {BLOG_POSTS.length === 0 && (
            <div className="blog-empty">
              <p>No posts yet. Check back soon.</p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Blog;
