import { useEffect, useState, useRef } from 'react';
import type { User } from 'firebase/auth';

// ── 1. Scroll Progress Bar ──────────────────────────────────────────────────
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

// ── 2. Animated Counter ─────────────────────────────────────────────────────
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        let start = 0;
        const duration = 1600;
        const step = (ts: number) => {
          if (!start) start = ts;
          const p = Math.min((ts - start) / duration, 1);
          setCount(Math.floor(p * target));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);
  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

// ── 3. Fade-In on Scroll ────────────────────────────────────────────────────
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
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── 4. FAQ Accordion Item ───────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`hp-faq-item${open ? ' hp-faq-open' : ''}`}>
      <button className="hp-faq-q" type="button" onClick={() => setOpen((v) => !v)}>
        <span>{q}</span>
        <span className="hp-faq-chevron">{open ? '−' : '+'}</span>
      </button>
      <div className="hp-faq-body" style={{ maxHeight: open ? 200 : 0 }}>
        <p className="hp-faq-a">{a}</p>
      </div>
    </div>
  );
}

// ── 5. Star Rating ──────────────────────────────────────────────────────────
function Stars({ count }: { count: number }) {
  return (
    <div className="hp-stars">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i}>★</span>
      ))}
    </div>
  );
}

// ── Main Home Page ──────────────────────────────────────────────────────────
export default function HomePage({
  user,
  userName,
}: {
  user: User | null;
  userName: string;
}) {
  const [bannerOpen, setBannerOpen] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="hp-root">
      {/* ── Feature 1: Scroll Progress ── */}
      <ScrollProgress />

      {/* ── Feature 2: Announcement Banner ── */}
      {bannerOpen && (
        <div className="hp-banner">
          <span>
            Now booking for spring.{' '}
            <a href="#/book-now" className="hp-banner-link">
              limited slots available
            </a>
          </span>
          <button
            className="hp-banner-close"
            type="button"
            aria-label="Dismiss"
            onClick={() => setBannerOpen(false)}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Feature 3: Hero Section ── */}
      <section className="hp-hero">
        <div className="hp-hero-bg" />
        <div className="hp-hero-inner">
          {/* Feature 4: Animated Badge */}
          <div className="hp-hero-badge">
            <span className="hp-badge-pulse" />
            Student-Owned Business
          </div>

          {/* Feature 5: Eyebrow */}
          {user ? (
            <p className="hp-eyebrow">Welcome back, {userName || user.email}</p>
          ) : (
            <p className="hp-eyebrow">Local · Honest · Dependable</p>
          )}

          {/* Feature 6 & 7: Hero Headline with Accent */}
          <h1 className="hp-headline">
            Your Car.
            <br />
            <span className="hp-headline-accent">Spotless.</span>
          </h1>

          {/* Feature 8: Hero Subtext */}
          <p className="hp-sub">
            TD Detailed is a student-owned car cleaning service delivering honest work, fair
            pricing, and a cleaner car every time.
          </p>

          {/* Feature 9: CTA Buttons */}
          <div className="hp-hero-actions">
            <a className="hp-btn-primary" href="#/book-now">
              Book Now
            </a>
            <a className="hp-btn-ghost" href="#/pricing">
              See Pricing
            </a>
            <a className="hp-btn-ghost" href="#/learn-more">
              Learn More
            </a>
          </div>

          {/* Feature 10: Hero Mini Stats */}
          <div className="hp-hero-stats">
            <div className="hp-hstat">
              <strong>
                <Counter target={120} suffix="+" />
              </strong>
              <span>Cars Cleaned</span>
            </div>
            <div className="hp-hstat-div" />
            <div className="hp-hstat">
              <strong>
                <Counter target={98} suffix="%" />
              </strong>
              <span>Satisfaction</span>
            </div>
            <div className="hp-hstat-div" />
            <div className="hp-hstat">
              <strong>
                <Counter target={3} />
              </strong>
              <span>Service Packages</span>
            </div>
          </div>
        </div>

        {/* Feature 11: Scroll Hint */}
        <div className="hp-scroll-hint">
          <span>Scroll</span>
          <div className="hp-scroll-line" />
        </div>
      </section>

      {/* ── Feature 12: Services Marquee Ticker ── */}
      <div className="hp-ticker-wrap" aria-hidden="true">
        <div className="hp-ticker-track">
          {[
            'Exterior Wash',
            'Interior Clean',
            'Full Detail',
            'Streak-Free Windows',
            'Vacuum & Wipe',
            'Tire Shine',
            'Exterior Wash',
            'Interior Clean',
            'Full Detail',
            'Streak-Free Windows',
            'Vacuum & Wipe',
            'Tire Shine',
          ].map((item, i) => (
            <span key={i} className="hp-ticker-item">
              {item} <span className="hp-ticker-dot">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Feature 13: Services Grid ── */}
      <section className="hp-section">
        <FadeIn>
          <div className="hp-section-label">What We Offer</div>
          <h2 className="hp-section-heading">Our Services</h2>
        </FadeIn>
        <div className="hp-services-grid">
          {[
            {
              icon: 'EX',
              title: 'Exterior Wash',
              desc: 'Full hand wash, rinse, and dry. Wheels cleaned, windows wiped streak-free.',
              tag: 'Most Popular',
            },
            {
              icon: 'IN',
              title: 'Interior Clean',
              desc: 'Full vacuum, dash wipe-down, door panels, cup holders, and all surfaces.',
              tag: '',
            },
            {
              icon: 'FD',
              title: 'Full Detail',
              desc: 'Complete exterior + interior service. Top-to-bottom thorough clean.',
              tag: 'Best Value',
            },
            {
              icon: 'AD',
              title: 'Add-Ons',
              desc: 'Tire shine, air freshener, pet hair removal, and other extras on request.',
              tag: '',
            },
          ].map((s, i) => (
            <FadeIn key={i} delay={i * 90}>
              {/* Feature 14: Service card with tag */}
              <article className="hp-service-card">
                {s.tag && <span className="hp-service-tag">{s.tag}</span>}
                {/* Feature 15: Service icon */}
                <div className="hp-service-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <a className="hp-service-link" href="#/pricing">
                  View Pricing →
                </a>
              </article>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Feature 16: Stats Section ── */}
      <section className="hp-stats-section">
        <FadeIn>
          <div className="hp-stats-grid">
            {[
              { n: 120, s: '+', label: 'Cars Cleaned' },
              { n: 98, s: '%', label: 'Happy Customers' },
              { n: 3, s: '', label: 'Service Packages' },
              { n: 1, s: '', label: 'Year in Business' },
            ].map((st, i) => (
              <div key={i} className="hp-stat-block">
                <div className="hp-stat-num">
                  <Counter target={st.n} suffix={st.s} />
                </div>
                <div className="hp-stat-label">{st.label}</div>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── Feature 17: Why Choose Us ── */}
      <section className="hp-section">
        <FadeIn>
          <div className="hp-section-label">Why TD Detailed</div>
          <h2 className="hp-section-heading">The Difference</h2>
        </FadeIn>
        <div className="hp-why-grid">
          {[
            {
              icon: '01',
              title: 'Student-Owned',
              desc: 'Operated by a local high school student. Every dollar supports a young entrepreneur.',
            },
            {
              icon: '02',
              title: 'Honest Work',
              desc: 'No shortcuts, no upsells. Thorough cleaning done the right way, every single time.',
            },
            {
              icon: '03',
              title: 'Fair Pricing',
              desc: 'Transparent, competitive prices with no hidden fees. You know exactly what you pay.',
            },
            {
              icon: '04',
              title: 'Locally Focused',
              desc: "We serve our community. You're not a ticket number — you're a neighbor.",
            },
            {
              icon: '05',
              title: 'Flexible Schedule',
              desc: 'We work weekends and after school hours to fit your life, not ours.',
            },
            {
              icon: '06',
              title: 'Safe & Reliable',
              desc: 'Your car is treated with care from start to finish. Always.',
            },
          ].map((w, i) => (
            <FadeIn key={i} delay={i * 75}>
              <article className="hp-why-card">
                <div className="hp-why-icon">{w.icon}</div>
                <h3>{w.title}</h3>
                <p>{w.desc}</p>
              </article>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Feature 18: How It Works ── */}
      <section className="hp-section hp-steps-section">
        <FadeIn>
          <div className="hp-section-label">Simple Process</div>
          <h2 className="hp-section-heading">How It Works</h2>
        </FadeIn>
        <div className="hp-steps-grid">
          {[
            {
              num: '01',
              title: 'Choose a Service',
              desc: 'Browse our packages and pick what your car needs — quick wash to full detail.',
            },
            {
              num: '02',
              title: 'Book Your Slot',
              desc: 'Pick a date and time that works for you. We confirm within 24 hours.',
            },
            {
              num: '03',
              title: 'We Do the Work',
              desc: "Your car gets cleaned. You drive away happy. It's that simple.",
            },
          ].map((step, i) => (
            <FadeIn key={i} delay={i * 120}>
              <div className="hp-step-card">
                <div className="hp-step-num">{step.num}</div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Feature 19: Testimonials ── */}
      <section className="hp-section">
        <FadeIn>
          <div className="hp-section-label">Real Customers</div>
          <h2 className="hp-section-heading">What People Say</h2>
        </FadeIn>
        <div className="hp-reviews-grid">
          {[
            {
              name: 'Mike R.',
              text: "Couldn't believe how clean my car looked. Better than the $30 drive-through wash I always use.",
              stars: 5,
            },
            {
              name: 'Sarah T.',
              text: 'Super professional for a student business. On time, thorough, and left zero streaks. Booked again the same week.',
              stars: 5,
            },
            {
              name: 'James L.',
              text: 'Great value. Interior was spotless — even got the crumbs out from under the seats. Will 100% be back.',
              stars: 5,
            },
          ].map((r, i) => (
            <FadeIn key={i} delay={i * 100}>
              <article className="hp-review-card">
                <Stars count={r.stars} />
                <p className="hp-review-text">"{r.text}"</p>
                <span className="hp-review-name">— {r.name}</span>
              </article>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Feature 20: Gallery Grid ── */}
      <section className="hp-section">
        <FadeIn>
          <div className="hp-section-label">Our Work</div>
          <h2 className="hp-section-heading">Before &amp; After</h2>
        </FadeIn>
        <div className="hp-gallery-grid">
          {[
            'Exterior Wash',
            'Interior Clean',
            'Tire Shine',
            'Dashboard Polish',
            'Full Detail',
            'Window Clean',
          ].map((label, i) => (
            <FadeIn key={i} delay={i * 65}>
              <div className="hp-gallery-item">
                <div
                  className="hp-gallery-placeholder"
                  style={{
                    background: `linear-gradient(135deg, hsl(${i * 35 + 195},18%,${88 + (i % 3) * 3}%), hsl(${i * 35 + 215},14%,${82 + (i % 2) * 5}%))`,
                  }}
                />
                <div className="hp-gallery-overlay">
                  <span>{label}</span>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={200}>
          <p className="hp-gallery-note">
            Photos coming soon — follow our progress as we build our portfolio.
          </p>
        </FadeIn>
      </section>

      {/* ── Feature 21 & 22: Pricing Teaser ── */}
      <section className="hp-section hp-pricing-teaser">
        <FadeIn>
          <div className="hp-pricing-inner">
            <div className="hp-pricing-copy">
              <div className="hp-section-label">Transparent Pricing</div>
              <h2 className="hp-section-heading" style={{ marginBottom: 12 }}>
                Clear &amp; Simple
              </h2>
              <p>No hidden fees. No surprise upsells. Just honest prices for honest work.</p>
              <ul className="hp-pricing-list">
                <li>
                  <span>Exterior Wash</span>
                  <span className="hp-price-tag">From $20</span>
                </li>
                <li>
                  <span>Interior Clean</span>
                  <span className="hp-price-tag">From $25</span>
                </li>
                <li>
                  <span>Full Detail</span>
                  <span className="hp-price-tag">From $40</span>
                </li>
              </ul>
              <a className="hp-btn-primary" href="#/pricing" style={{ marginTop: 24 }}>
                See Full Pricing
              </a>
            </div>
            {/* Feature 22: Pricing Badge */}
            <div className="hp-pricing-badge-wrap">
              <div className="hp-pricing-badge">
                <div className="hp-pb-top">Starting at</div>
                <div className="hp-pb-price">$20</div>
                <div className="hp-pb-bottom">per service</div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Feature 23: FAQ Accordion ── */}
      <section className="hp-section">
        <FadeIn>
          <div className="hp-section-label">Got Questions?</div>
          <h2 className="hp-section-heading">Frequently Asked</h2>
        </FadeIn>
        <FadeIn delay={100}>
          <div className="hp-faq-list">
            <FAQItem
              q="How long does a service take?"
              a="Exterior washes take 30–45 minutes. Interior cleans and full details can take 1–2 hours depending on vehicle size and condition."
            />
            <FAQItem
              q="Do you come to my location?"
              a="Yes! We're mobile — just provide your address when booking and we'll come to you."
            />
            <FAQItem
              q="What payment methods do you accept?"
              a="We accept cash, Venmo, and Cash App. Payment is due at the time of service."
            />
            <FAQItem
              q="Can I book recurring appointments?"
              a="Absolutely! Many customers book weekly or bi-weekly. Just mention it in the notes when booking."
            />
            <FAQItem
              q="What if I need to reschedule?"
              a="No problem — just contact us at least 24 hours before your appointment and we'll find a new time that works."
            />
          </div>
        </FadeIn>
      </section>

      {/* ── Feature 24 & 25: Service Area + Hours ── */}
      <section className="hp-section">
        <div className="hp-info-grid">
          <FadeIn>
            <div className="hp-info-card">
              <div className="hp-section-label">Where We Operate</div>
              <h3 className="hp-info-heading">Service Area</h3>
              <p>
                We serve our local neighborhood and surrounding areas. Reach out before booking to
                confirm we cover your address.
              </p>
              <ul className="hp-info-list">
                <li>Local residential areas</li>
                <li>Nearby driveways and parking lots</li>
                <li>Expanded coverage coming soon</li>
              </ul>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="hp-info-card">
              <div className="hp-section-label">When We're Available</div>
              <h3 className="hp-info-heading">Business Hours</h3>
              <ul className="hp-hours-list">
                <li>
                  <span>Monday – Friday</span>
                  <span>After 3:00 PM</span>
                </li>
                <li>
                  <span>Saturday</span>
                  <span>9:00 AM – 6:00 PM</span>
                </li>
                <li>
                  <span>Sunday</span>
                  <span>10:00 AM – 4:00 PM</span>
                </li>
              </ul>
              <p className="hp-hours-note">Hours may vary — check availability when booking.</p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Feature 26: Trust Badges ── */}
      <FadeIn>
        <div className="hp-trust-bar">
          {[
            'Student-Owned',
            'Satisfaction Goal',
            'No Hidden Fees',
            'Responsive Support',
            'Mobile Service',
            '5-Star Rated',
          ].map((badge, i) => (
            <span key={i} className="hp-trust-badge">
              {badge}
            </span>
          ))}
        </div>
      </FadeIn>

      {/* ── Feature 27: Final CTA ── */}
      <section className="hp-cta-section">
        <FadeIn>
          <div className="hp-cta-inner">
            <h2>Ready for a Cleaner Car?</h2>
            <p>Book in minutes. We handle the rest.</p>
            <div className="hp-cta-actions">
              <a className="hp-btn-primary hp-btn-large" href="#/book-now">
                Book Now
              </a>
              <a className="hp-btn-white hp-btn-large" href="#/learn-more">
                Learn More
              </a>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Feature 28: Footer ── */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-brand">
            <span className="hp-footer-logo">TD Detailed</span>
            <p>Student-owned car cleaning. Honest work. Local pride.</p>
          </div>
          <div className="hp-footer-links">
            <strong>Navigate</strong>
            <a href="#/">Home</a>
            <a href="#/learn-more">About</a>
            <a href="#/pricing">Pricing</a>
            <a href="#/book-now">Book Now</a>
          </div>
          <div className="hp-footer-links">
            <strong>Account</strong>
            <a href="#/signup">Sign Up</a>
            <a href="#/login">Log In</a>
          </div>
        </div>
        <div className="hp-footer-bottom">
          © {new Date().getFullYear()} TD Detailed. All rights reserved.
        </div>
      </footer>

      {/* ── Feature 29: Floating Book Now Button ── */}
      <a className="hp-float-book" href="#/book-now">
        Book Now
      </a>

      {/* ── Feature 30: Scroll-to-Top Button ── */}
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
