import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { gsap } from 'gsap';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { BLOG_POSTS, AUTHORS } from '../data/blogPosts';
import './BlogPost.css';

/* ── Section renderer ─────────────────────────────────────────────────────── */
const Section = ({ block }) => {
  switch (block.type) {
    case 'heading':
      return <h2 className="bp__h2">{block.text}</h2>;

    case 'subheading':
      return <h3 className="bp__h3">{block.text}</h3>;

    case 'paragraph':
      // Render **bold** inline markdown
      return (
        <p className="bp__p" dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />
      );

    case 'list':
      return (
        <ul className="bp__list">
          {block.items.map((item, i) => (
            <li key={i} className="bp__li" dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
          ))}
        </ul>
      );

    case 'callout':
      return (
        <div className={`bp__callout bp__callout--${block.variant || 'info'}`}>
          <span className="bp__callout-icon">
            {block.variant === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <p className="bp__callout-text" dangerouslySetInnerHTML={{ __html: renderInline(block.text) }} />
        </div>
      );

    case 'divider':
      return <hr className="bp__divider" />;

    default:
      return null;
  }
};

/** Render **bold** and `code` inline markdown to HTML safely */
function renderInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

/* ── Main component ──────────────────────────────────────────────────────── */
const BlogPost = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const headerRef = useRef(null);
  const bodyRef = useRef(null);

  const post = BLOG_POSTS.find(p => p.slug === slug);
  const author = post ? AUTHORS[post.author] : null;

  useEffect(() => {
    window.scrollTo(0, 0);
    if (!post) return;
    const tl = gsap.timeline({ delay: 0.05 });
    tl.fromTo(headerRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.65, ease: 'power3.out' });
    tl.fromTo(bodyRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, '-=0.25');
    return () => tl.kill();
  }, [post]);

  if (!post) {
    return (
      <div className="bp-page">
        <Navbar />
        <div className="bp-notfound">
          <h2>Post not found</h2>
          <button onClick={() => navigate('/blogs')}>← Back to Blog</button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bp-page">
      <Navbar />

      {/* ── Hero header ── */}
      <div className="bp-hero" ref={headerRef}>
        <div className="bp-hero__cover" style={{ background: post.coverGradient }}>
          <div className="bp-hero__cover-fade" />
        </div>
        <div className="bp-hero__content">
          <button className="bp-hero__back" onClick={() => navigate('/blogs')}>
            &#8592; Blog
          </button>
          <div className="bp-hero__tags">
            {post.tags.map(tag => (
              <span key={tag} className="bp-hero__tag">{tag}</span>
            ))}
          </div>
          <h1 className="bp-hero__title">{post.title}</h1>
          <p className="bp-hero__subtitle">{post.subtitle}</p>
          <div className="bp-hero__meta">
            <div className="bp-hero__author">
              <div className="bp-hero__author-avatar">{author.avatar}</div>
              <div>
                <div className="bp-hero__author-name">{author.name}</div>
                <div className="bp-hero__author-role">{author.role}</div>
              </div>
            </div>
            <div className="bp-hero__stats">
              <span>{new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="bp-hero__sep">·</span>
              <span>{post.readTime}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Article body ── */}
      <div className="bp-body" ref={bodyRef}>
        <div className="bp-body__inner">

          {/* Author sidebar card */}
          <aside className="bp-author-card">
            <div className="bp-author-card__avatar">{author.avatar}</div>
            <div className="bp-author-card__name">{author.name}</div>
            <div className="bp-author-card__role">{author.role}</div>
            <p className="bp-author-card__bio">{author.bio}</p>
            <div className="bp-author-card__divider" />
            <div className="bp-author-card__date">
              Published {new Date(post.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <div className="bp-author-card__read">{post.readTime}</div>
          </aside>

          {/* Main article */}
          <article className="bp-article">
            {post.content.map((block, i) => (
              <Section key={i} block={block} />
            ))}

            <div className="bp-article__footer">
              <button className="bp-article__back-btn" onClick={() => navigate('/blogs')}>
                &#8592; Back to Blog
              </button>
            </div>
          </article>

        </div>
      </div>

      <Footer />
    </div>
  );
};

export default BlogPost;
