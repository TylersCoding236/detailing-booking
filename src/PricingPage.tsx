import { useEffect, useMemo, useState } from 'react';
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

  const hasItems = useMemo(() => items.length > 0, [items.length]);

  return (
    <section className="panel fade-in pricing-page">
      <div className="pricing-header">
        <h2>Pricing</h2>
      </div>

      {loading && <p>Loading pricing...</p>}
      {error && <p style={{ color: '#bb1e14' }}>{error}</p>}

      {!loading && !error && !hasItems && <p>No pricing items available yet.</p>}

      {!loading && hasItems && (
        <div className="pricing-grid">
          {items.map((item) => (
            <article className="price-card" key={item.id}>
              <div className="price-row">
                <h3>{item.detailName}</h3>
                <p className="price-value">{item.price}</p>
              </div>
              <p>{item.description}</p>
              {item.isSpecialOffer && (
                <span className="offer-tag">Special Offer</span>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
