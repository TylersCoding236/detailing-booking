import { useEffect, useMemo, useState } from 'react';
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
  detailName: string;
  price: string;
  description: string;
  isSpecialOffer: boolean;
  isEnabled: boolean;
  displayOrder: number;
};

type PackageDetail = {
  title: string;
  price: string;
  summary: string;
  includes: string[];
  bestFor: string;
  turnaround: string;
};

const SERVICE_CATALOG: Array<{
  key: 'exterior' | 'interior' | 'full';
  label: string;
  price: string;
  description: string;
  order: number;
}> = [
  {
    key: 'exterior',
    label: 'Exterior Refresh',
    price: '$50.00',
    description: 'Hand wash, dry, wheels, and glass cleaned for a solid reset.',
    order: 1,
  },
  {
    key: 'interior',
    label: 'Interior Reset',
    price: '$50.00',
    description: 'Vacuum, wipe-down, and main interior surfaces cleaned.',
    order: 2,
  },
  {
    key: 'full',
    label: 'Full Detail',
    price: '$70.00',
    description: 'Complete interior and exterior detail service.',
    order: 3,
  },
];

function getServiceKey(name: string): 'exterior' | 'interior' | 'full' | null {
  const value = name.toLowerCase();
  if (value.includes('exterior')) return 'exterior';
  if (value.includes('interior')) return 'interior';
  if (value.includes('full')) return 'full';
  return null;
}

const PACKAGE_DETAILS: Record<'exterior' | 'interior' | 'full', PackageDetail> = {
  exterior: {
    title: 'Exterior Refresh',
    price: '$50.00',
    summary: 'A quick exterior reset that brings back a clean, sharp look.',
    includes: [
      'Hand wash and dry',
      'Wheel face and tire clean',
      'Exterior glass cleaned',
      'Basic body wipe for leftover spots',
    ],
    bestFor: 'Weekly or bi-weekly maintenance and daily-driven vehicles.',
    turnaround: 'About 45-60 minutes depending on vehicle size and condition.',
  },
  interior: {
    title: 'Interior Reset',
    price: '$50.00',
    summary: 'A clean interior pass focused on the areas you use most.',
    includes: [
      'Full interior vacuum',
      'Dashboard and console wipe-down',
      'Door panel and touch-point cleaning',
      'Interior glass cleaned',
    ],
    bestFor: 'Dust, crumbs, and everyday interior buildup.',
    turnaround: 'About 45-60 minutes based on interior condition.',
  },
  full: {
    title: 'Full Detail',
    price: '$70.00',
    summary: 'Our full inside-and-out package for the cleanest overall finish.',
    includes: [
      'Everything in Exterior Refresh',
      'Everything in Interior Reset',
      'Final finish check before handoff',
      'Balanced full-vehicle clean in one visit',
    ],
    bestFor: 'Monthly reset, pre-event cleanup, or first-time appointments.',
    turnaround: 'About 90-120 minutes depending on vehicle size and condition.',
  },
};

function pick(data: DocumentData, keys: string[]): unknown {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) {
      return data[key];
    }
  }
  return undefined;
}

function toEnabledFlag(raw: unknown): boolean {
  if (raw === undefined || raw === null) {
    return true;
  }

  if (typeof raw === 'boolean') {
    return raw;
  }

  const value = String(raw).trim().toLowerCase();
  if (['false', 'disabled', 'disable', 'hidden', 'inactive', 'off', '0'].includes(value)) {
    return false;
  }

  return true;
}

function toPriceItem(id: string, data: DocumentData): PriceItem {
  const rawName = pick(data, ['detailName', 'name', 'Name', 'serviceName']);
  const rawPrice = pick(data, ['price', 'Price', 'cost']);
  const rawDescription = pick(data, [
    'description',
    'Description',
    'details',
    'desc',
  ]);
  const rawSpecialOffer = pick(data, [
    'isSpecialOffer',
    'specialOffer',
    'special',
    'isOffer',
  ]);
  const rawEnabled = pick(data, [
    'isEnabled',
    'enabled',
    'isActive',
    'active',
    'visibility',
    'status',
  ]);
  const rawOrder = pick(data, ['displayOrder', 'DisplayOrder', 'order', 'rank']);

  const formattedPrice =
    typeof rawPrice === 'number'
      ? `$${rawPrice.toFixed(2)}`
      : String(rawPrice ?? '').trim();

  const parsedOrder =
    typeof rawOrder === 'number'
      ? rawOrder
      : Number.parseInt(String(rawOrder ?? ''), 10);

  return {
    id,
    detailName: String(rawName ?? '').trim() || 'Service Name Needed',
    price: formattedPrice || 'Price Needed',
    description:
      String(rawDescription ?? '').trim() ||
      'Add a description field in Firebase for this service.',
    isSpecialOffer: Boolean(rawSpecialOffer),
    isEnabled: toEnabledFlag(rawEnabled),
    displayOrder: Number.isFinite(parsedOrder) ? parsedOrder : 9999,
  };
}

export default function PricingPage() {
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDB, setFromDB] = useState(false);
  const [activePackage, setActivePackage] = useState<'exterior' | 'interior' | 'full' | null>(null);

  useEffect(() => {
    const pricingRef = collection(db, 'pricing');

    const unsub = onSnapshot(
      pricingRef,
      (snapshot) => {
        const parsed = snapshot.docs.map((doc) => toPriceItem(doc.id, doc.data()));
        const next = parsed
          .filter((item) => item.isEnabled)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        setItems(next);
        setFromDB(next.length > 0);
        setLoading(false);
        setError('');
      },
      (err) => {
        console.error('Pricing read error:', err);
        if (err instanceof FirebaseError) {
          if (err.code === 'permission-denied') {
            setError('Could not load pricing: Firestore rules are blocking reads for pricing.');
          } else {
            setError(`Could not load pricing: ${err.code}`);
          }
        } else {
          setError('Could not load pricing right now.');
        }
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const displayItems = useMemo(() => {
    const byKey = new Map<'exterior' | 'interior' | 'full', PriceItem>();
    for (const item of items) {
      const key = getServiceKey(item.detailName);
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, item);
      }
    }

    return SERVICE_CATALOG.map((service) => {
      const existing = byKey.get(service.key);
      return {
        id: existing?.id ?? `default-${service.key}`,
        detailName: (existing?.detailName?.trim()) || service.label,
        price: existing?.price || service.price,
        description: existing?.description?.trim() || service.description,
        isSpecialOffer: Boolean(existing?.isSpecialOffer),
        isEnabled: true,
        displayOrder: service.order,
        key: service.key,
      };
    });
  }, [items]);

  useEffect(() => {
    if (!activePackage) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setActivePackage(null);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePackage]);

  const packageModal =
    activePackage && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="price-modal-overlay"
            onClick={() => setActivePackage(null)}
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
                  <h3>{PACKAGE_DETAILS[activePackage].title}</h3>
                </div>
                <button
                  type="button"
                  className="price-modal-close"
                  onClick={() => setActivePackage(null)}
                  aria-label="Close package details"
                >
                  ×
                </button>
              </div>

              <p className="price-modal-value">{displayItems.find(i => i.key === activePackage)?.price ?? PACKAGE_DETAILS[activePackage].price}</p>
              <p className="price-modal-summary">{PACKAGE_DETAILS[activePackage].summary}</p>

              <div className="price-modal-block">
                <h4>What&apos;s Included</h4>
                <ul>
                  {PACKAGE_DETAILS[activePackage].includes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <p className="price-modal-meta">
                <strong>Best for:</strong> {PACKAGE_DETAILS[activePackage].bestFor}
              </p>
              <p className="price-modal-meta">
                <strong>Typical time:</strong> {PACKAGE_DETAILS[activePackage].turnaround}
              </p>

              <div className="price-modal-actions">
                <a className="price-modal-book" href="#/book-now" onClick={() => setActivePackage(null)}>
                  Book This Package
                </a>
                <button type="button" className="price-modal-secondary" onClick={() => setActivePackage(null)}>
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
          <p className="pricing-subtitle">Three simple detail packages with clear pricing.</p>
        </div>

        {loading && <p>Loading pricing...</p>}
        {!loading && error && <p style={{ color: '#bb1e14' }}>{error}</p>}
        {!loading && !error && !fromDB && (
          <p style={{ fontSize: '0.8rem', color: '#999', marginBottom: '8px' }}>
            Showing default prices — connect Firestore to manage live pricing.
          </p>
        )}

        {!loading && !error && (
          <div className="pricing-grid">
            {displayItems.map((item) => (
              <article className="price-card" key={item.id}>
                <div className="price-top">
                  <span className="price-chip">Package</span>
                  {item.isSpecialOffer && <span className="offer-tag">Special Offer</span>}
                </div>
                <div className="price-row">
                  <h3>{item.detailName}</h3>
                  <p className="price-value">{item.price}</p>
                </div>
                <p className="price-description">{item.description}</p>
                <button
                  type="button"
                  className="price-view-btn"
                  onClick={() => {
                    const key = getServiceKey(item.detailName);
                    if (key) setActivePackage(key);
                  }}
                >
                  View Package
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {packageModal}
    </>
  );
}
