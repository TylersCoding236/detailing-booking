import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  collection,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';

type PriceItem = {
  id: string;
  name: string;
  price: string;
  priceNum: number | null;
  description: string;
  isSpecialOffer: boolean;
  displayOrder: number;
};

function toPriceItem(id: string, data: DocumentData): PriceItem {
  const rawPrice = data.price ?? data.Price ?? data.cost;
  const priceNum = typeof rawPrice === 'number' ? rawPrice : null;
  const priceStr =
    typeof rawPrice === 'number'
      ? `$${rawPrice.toFixed(2)}`
      : String(rawPrice ?? '').trim() || 'TBD';
  const rawOrder = data.displayOrder ?? data.order ?? 9999;
  return {
    id,
    name: String(data.detailName ?? data.name ?? data.serviceName ?? '').trim() || 'Unnamed Package',
    price: priceStr,
    priceNum,
    description: String(data.description ?? data.desc ?? '').trim(),
    isSpecialOffer: Boolean(data.isSpecialOffer ?? data.specialOffer),
    displayOrder: Number.isFinite(Number(rawOrder)) ? Number(rawOrder) : 9999,
  };
}

export default function PricingPage() {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeItem, setActiveItem] = useState<PriceItem | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'pricing'),
      (snapshot) => {
        const parsed = snapshot.docs
          .map((d) => toPriceItem(d.id, d.data()))
          .filter((_, i) => snapshot.docs[i].data().isEnabled !== false)
          .sort((a, b) => a.displayOrder - b.displayOrder);
        setItems(parsed);
        setLoading(false);
        setError('');
      },
      (err) => {
        if (err instanceof FirebaseError) {
          setError(
            err.code === 'permission-denied'
              ? 'Firestore rules must be published. Go to Firebase Console → Firestore → Rules and publish firestore.rules.'
              : `Could not load pricing: ${err.code}`
          );
        } else {
          setError('Could not load pricing right now.');
        }
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeItem) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActiveItem(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeItem]);

  const modal =
    activeItem && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="price-modal-overlay"
            onClick={() => setActiveItem(null)}
          >
            <div
              className="price-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Package details"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="price-modal-head">
                <div>
                  <p className="price-modal-kicker">Package Details</p>
                  <h3>{activeItem.name}</h3>
                </div>
                <button
                  type="button"
                  className="price-modal-close"
                  onClick={() => setActiveItem(null)}
                  aria-label="Close package details"
                >
                  ×
                </button>
              </div>

              <p className="price-modal-value">{activeItem.price}</p>
              {activeItem.description && (
                <p className="price-modal-summary">{activeItem.description}</p>
              )}

              <div className="price-modal-actions">
                <a className="price-modal-book" href="#/book-now" onClick={() => setActiveItem(null)}>
                  Book This Package
                </a>
                <button type="button" className="price-modal-secondary" onClick={() => setActiveItem(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <section className="panel pricing-page">
        <div className="pricing-header">
          <h2>Pricing</h2>
          <p className="pricing-subtitle">Simple detail packages with clear pricing.</p>
        </div>

        {loading && <p>Loading pricing...</p>}

        {!loading && error && (
          <div className="dash-rules-warning">
            <strong>⚠ Prices could not be loaded</strong>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p style={{ color: '#999' }}>No packages available yet. Check back soon.</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="pricing-grid">
            {items.map((item) => (
              <article className="price-card" key={item.id}>
                <div className="price-top">
                  <span className="price-chip">Package</span>
                  {item.isSpecialOffer && <span className="offer-tag">Special Offer</span>}
                </div>
                <div className="price-row">
                  <h3>{item.name}</h3>
                  <p className="price-value">{item.price}</p>
                </div>
                {item.description && (
                  <p className="price-description">{item.description}</p>
                )}
                <button
                  type="button"
                  className="price-view-btn"
                  onClick={() => setActiveItem(item)}
                >
                  View Package
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {modal}
    </>
  );
}
