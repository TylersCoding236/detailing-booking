import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from './firebase';
import { DETAIL_PACKAGES } from './detailPackages';

function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      setProgress(pct);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <div className="hp-scroll-progress" style={{ width: `${progress}%` }} />;
}

function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

type GalleryItem = {
  id: string;
  title: string;
  imageUrl: string;
  tone: string;
  sortOrder: number;
  isFeatured: boolean;
  isEnabled: boolean;
};

type NewsItem = {
  id: string;
  title: string;
  version: string;
  body: string;
  isEnabled: boolean;
  sortTime: number;
};

const NEWS_SEEN_KEY = 'td_news_last_seen_id';

const services = DETAIL_PACKAGES.map((item) => ({
  icon: item.icon,
  title: item.title,
  price: `$${item.price}`,
  desc: item.description,
}));

const bookingSteps = [
  {
    num: '01',
    title: 'Create your account',
    desc: 'Sign up once so your info stays attached to every booking.',
  },
  {
    num: '02',
    title: 'Add booking details',
    desc: 'Save your name, phone, and address so we know exactly where to go.',
  },
  {
    num: '03',
    title: 'Pick a package and time',
    desc: 'Choose what you need, request your slot, and wait for confirmation.',
  },
];

const fallbackGallery: GalleryItem[] = [
  { id: 'a', title: 'Exterior finish', imageUrl: '', tone: 'warm', sortOrder: 0, isFeatured: true, isEnabled: true },
  { id: 'b', title: 'Interior recovery', imageUrl: '', tone: 'cool', sortOrder: 1, isFeatured: false, isEnabled: true },
  { id: 'c', title: 'Glass and trim', imageUrl: '', tone: 'gold', sortOrder: 2, isFeatured: false, isEnabled: true },
  { id: 'd', title: 'Seats and console', imageUrl: '', tone: 'graphite', sortOrder: 3, isFeatured: false, isEnabled: true },
];

function toGalleryItem(id: string, data: DocumentData): GalleryItem {
  return {
    id,
    title: String(data.title ?? data.label ?? ''),
    imageUrl: String(data.imageUrl ?? ''),
    tone: String(data.tone ?? 'warm'),
    sortOrder: Number(data.sortOrder ?? 0),
    isFeatured: Boolean(data.isFeatured),
    isEnabled: data.isEnabled !== false,
  };
}

function getSortTime(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function toNewsItem(id: string, data: DocumentData): NewsItem {
  return {
    id,
    title: String(data.title ?? ''),
    version: String(data.version ?? ''),
    body: String(data.body ?? ''),
    isEnabled: data.isEnabled !== false,
    sortTime: Math.max(getSortTime(data.updatedAt), getSortTime(data.createdAt)),
  };
}

function getUpdatePoints(body: string): string[] {
  return body
    .split(/\n|;|•/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function HomePage({
  user,
  userName,
}: {
  user: User | null;
  userName: string;
}) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [unseenNewsCount, setUnseenNewsCount] = useState(0);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(fallbackGallery);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (newsItems.length === 0) {
      setUnseenNewsCount(0);
      return;
    }

    const lastSeenId = localStorage.getItem(NEWS_SEEN_KEY);
    if (!lastSeenId) {
      setUnseenNewsCount(newsItems.length);
      return;
    }

    const seenIndex = newsItems.findIndex((item) => item.id === lastSeenId);
    if (seenIndex === -1) {
      setUnseenNewsCount(newsItems.length);
      return;
    }

    setUnseenNewsCount(seenIndex);
  }, [newsItems]);

  function openNewsPanel() {
    setNewsOpen(true);
    if (newsItems.length > 0) {
      localStorage.setItem(NEWS_SEEN_KEY, newsItems[0].id);
      setUnseenNewsCount(0);
    }
  }

  function closeNewsPanel() {
    setNewsOpen(false);
  }

  function toggleNewsPanel() {
    if (newsOpen) {
      closeNewsPanel();
    } else {
      openNewsPanel();
    }
  }

  useEffect(() => {
    const unsubGallery = onSnapshot(
      collection(db, 'galleryItems'),
      (snap) => {
        const rows = snap.docs
          .map((docSnap) => toGalleryItem(docSnap.id, docSnap.data()))
          .filter((item) => item.isEnabled)
          .sort((a, b) => a.sortOrder - b.sortOrder);

        setGalleryItems(rows.length > 0 ? rows : fallbackGallery);
      },
      () => {
        setGalleryItems(fallbackGallery);
      }
    );

    const unsubNews = onSnapshot(
      collection(db, 'siteNews'),
      (snap) => {
        const rows = snap.docs
          .map((docSnap) => toNewsItem(docSnap.id, docSnap.data()))
          .filter((item) => item.isEnabled)
          .sort((a, b) => (b.sortTime - a.sortTime) || b.id.localeCompare(a.id));
        setNewsItems(rows);
      },
      () => {
        setNewsItems([]);
      }
    );

    return () => {
      unsubGallery();
      unsubNews();
    };
  }, []);

  const featuredGallery = galleryItems.find((item) => item.isFeatured) || galleryItems[0];
  const supportingGallery = galleryItems
    .filter((item) => item.id !== featuredGallery?.id)
    .slice(0, 4);

  return (
    <div className="hp-root">
      <ScrollProgress />

      <section className="hp-hero">
        <div className="hp-hero-bg" />
        <div className="hp-hero-inner hp-hero-layout">
          <div className="hp-hero-copy">
            <div className="hp-hero-badge">
              <span className="hp-badge-pulse" />
              TD Detailed
            </div>

            {user ? (
              <p className="hp-eyebrow">Welcome back, {userName || user.email}</p>
            ) : (
              <p className="hp-eyebrow">Clean cars without the clutter</p>
            )}

            <h1 className="hp-headline">
              Clean look.
              <br />
              <span className="hp-headline-accent">Simple booking.</span>
            </h1>

            <p className="hp-sub">
              Mobile detailing with clear packages, account-based booking, and straightforward site
              updates.
            </p>

            <div className="hp-hero-actions">
              <a className="hp-btn-primary" href="#/book-now">
                Book Now
              </a>
              <a className="hp-btn-ghost" href="#/pricing">
                View Pricing
              </a>
            </div>

            <div className="hp-hero-stats">
              <div className="hp-hstat">
                <strong>Mobile</strong>
                <span>We come to you</span>
              </div>
              <div className="hp-hstat-div" />
              <div className="hp-hstat">
                <strong>Account-based</strong>
                <span>Booking details saved</span>
              </div>
            </div>
          </div>

          <FadeIn className="hp-hero-panel" delay={100}>
            <p className="hp-panel-kicker">Booking flow</p>
            <h2>Book without confusion</h2>
            <div className="hp-mini-steps">
              {bookingSteps.map((step) => (
                <div key={step.num} className="hp-mini-step">
                  <span>{step.num}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="hp-hero-panel-actions">
              <a className="hp-btn-primary" href={user ? '#/verify-account' : '#/signup'}>
                {user ? 'Set Booking Details' : 'Create Account'}
              </a>
            </div>
          </FadeIn>
        </div>

        <div className="hp-scroll-hint">
          <span>Scroll</span>
          <div className="hp-scroll-line" />
        </div>
      </section>

      <section className="hp-section">
        <FadeIn>
          <div className="hp-section-label">Services</div>
          <h2 className="hp-section-heading">Services</h2>
        </FadeIn>
        <div className="hp-services-grid hp-services-grid--compact">
          {services.map((service, index) => (
            <FadeIn key={service.title} delay={index * 80}>
              <article className="hp-service-card">
                <div className="hp-service-icon">{service.icon}</div>
                <h3>{service.title}</h3>
                <p className="hp-service-price">{service.price}</p>
                <p>{service.desc}</p>
                <a className="hp-service-link" href="#/pricing">
                  Check package details
                </a>
              </article>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="hp-section hp-booking-section">
        <FadeIn>
          <div className="hp-section-label">How To Book</div>
          <h2 className="hp-section-heading">How booking works</h2>
        </FadeIn>
        <div className="hp-process-layout">
          <div className="hp-process-grid">
            {bookingSteps.map((step, index) => (
              <FadeIn key={step.num} delay={index * 90}>
                <article className="hp-process-card">
                  <div className="hp-process-number">{step.num}</div>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </article>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={220} className="hp-process-aside">
            <div className="hp-panel-kicker">Quick note</div>
            <h3>If you already have an account, booking is fast.</h3>
            <p>
              Log in, review your saved details, then request your package and time.
            </p>
            <a className="hp-btn-ghost" href={user ? '#/dashboard' : '#/login'}>
              {user ? 'Open Dashboard' : 'Log In'}
            </a>
          </FadeIn>
        </div>
      </section>

      <section className="hp-section">
        <FadeIn>
          <div className="hp-section-label">Gallery</div>
          <h2 className="hp-section-heading">Recent work</h2>
        </FadeIn>
        <div className="hp-gallery-showcase">
          <FadeIn className="hp-gallery-feature">
            <div className="hp-gallery-photo hp-gallery-photo--feature">
              {featuredGallery?.imageUrl ? (
                <img
                  className="hp-gallery-image hp-gallery-image--feature"
                  src={featuredGallery.imageUrl}
                  alt={featuredGallery.title}
                />
              ) : null}
            </div>
            <div className="hp-gallery-copy">
              <strong>{featuredGallery?.title || 'Featured detail'}</strong>
              <p>
                Real photos added by your team from the dashboard gallery editor.
              </p>
            </div>
          </FadeIn>
          <div className="hp-gallery-grid hp-gallery-grid--mosaic">
            {supportingGallery.map((item, index) => (
              <FadeIn key={item.id} delay={index * 70}>
                <div className={`hp-gallery-item hp-gallery-item--${item.tone}`}>
                  {item.imageUrl ? <img className="hp-gallery-image" src={item.imageUrl} alt={item.title} /> : <div className="hp-gallery-placeholder" />}
                  <div className="hp-gallery-overlay hp-gallery-overlay--always">
                    <span>{item.title}</span>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="hp-cta-section">
        <FadeIn>
          <div className="hp-cta-inner">
            <h2>Ready to book?</h2>
            <p>Choose a package and request a time.</p>
            <div className="hp-cta-actions">
              <a className="hp-btn-primary hp-btn-large" href="#/book-now">
                Book Now
              </a>
              <a className="hp-btn-white hp-btn-large" href="#/pricing">
                Pricing
              </a>
            </div>
          </div>
        </FadeIn>
      </section>

      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-brand">
            <span className="hp-footer-logo">TD Detailed</span>
            <p>Student-owned mobile detailing with a simpler path to book.</p>
          </div>
          <div className="hp-footer-links">
            <strong>Browse</strong>
            <a href="#/">Home</a>
            <a href="#/pricing">Pricing</a>
            <a href="#/book-now">Book Now</a>
          </div>
          <div className="hp-footer-links">
            <strong>Account</strong>
            <a href="#/signup">Sign Up</a>
            <a href="#/login">Log In</a>
          </div>
        </div>
        <div className="hp-footer-bottom">© {new Date().getFullYear()} TD Detailed</div>
      </footer>

      {!newsOpen && (
        <button
          type="button"
          className="hp-news-toggle"
          onClick={toggleNewsPanel}
        >
          <span className="hp-news-toggle-text">Site Updates</span>
          {unseenNewsCount > 0 && <span className="hp-news-badge">{unseenNewsCount}</span>}
        </button>
      )}

      <aside className={`hp-news-panel${newsOpen ? ' hp-news-panel-open' : ''}`}>
        <div className="hp-news-head">
          <div>
            <h3>What&apos;s New</h3>
            <p className="hp-news-sub">Version notes and recent site updates</p>
          </div>
          <button type="button" onClick={closeNewsPanel} aria-label="Close updates panel">
            ×
          </button>
        </div>

        <div className="hp-news-body">
          {newsItems.length === 0 && <p className="hp-news-empty">No updates posted yet.</p>}
          {newsItems.map((news, index) => (
            <article key={news.id} className={`hp-news-item${index === 0 ? ' hp-news-item-latest' : ''}`}>
              <div className="hp-news-title-row">
                <strong>{news.title}</strong>
                <span className="hp-news-id">Update {String(index + 1).padStart(2, '0')}</span>
              </div>

              <div className="hp-news-meta-row">
                {news.version ? <span className="hp-news-version">{news.version}</span> : <span className="hp-news-version hp-news-version-muted">General</span>}
                {index === 0 && <span className="hp-news-latest-pill">Latest</span>}
              </div>

              {getUpdatePoints(news.body).length > 1 ? (
                <ul className="hp-news-points">
                  {getUpdatePoints(news.body).map((point, pointIndex) => (
                    <li key={`${news.id}-${pointIndex}`}>{point}</li>
                  ))}
                </ul>
              ) : (
                <p>{news.body}</p>
              )}
            </article>
          ))}
        </div>
      </aside>

      <a className="hp-float-book" href="#/book-now">
        Book Now
      </a>

      {showScrollTop && (
        <button
          className="hp-scroll-top"
          type="button"
          aria-label="Scroll to top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
      )}
    </div>
  );
}
