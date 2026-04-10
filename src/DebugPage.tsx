import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';

function hasAny(data: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => data[key] !== undefined && data[key] !== null);
}

export default function DebugPage() {
  const [docCount, setDocCount] = useState(0);
  const [shownCount, setShownCount] = useState(0);
  const [disabledCount, setDisabledCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'pricing'),
      (snapshot) => {
        const visibleCount = snapshot.docs.filter((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const rawEnabled =
            data.isEnabled ??
            data.enabled ??
            data.isActive ??
            data.active ??
            data.visibility ??
            data.status;

          const normalized = String(rawEnabled ?? 'true').trim().toLowerCase();
          const isDisabled =
            rawEnabled === false ||
            ['false', 'disabled', 'disable', 'hidden', 'inactive', 'off', '0'].includes(normalized);

          return !isDisabled;
        }).length;

        setDocCount(snapshot.docs.length);
        setShownCount(visibleCount);
        setDisabledCount(snapshot.docs.length - visibleCount);
        setError('');
      },
      (err) => {
        if (err instanceof FirebaseError) {
          setError(err.code);
        } else {
          setError('unknown-error');
        }
      }
    );

    return () => unsub();
  }, []);

  return (
    <section className="panel fade-in debug-page">
      <h2>Debug</h2>

      <div className="schema-note">
        <h3>Pricing Setup</h3>
        <ul>
          <li>Add or edit pricing in the pricing collection.</li>
          <li>Use fields: detailName, price, description, isSpecialOffer, displayOrder.</li>
          <li>Optional hide field: isEnabled (false hides item) or status = disabled.</li>
          <li>Rules must allow read on /pricing.</li>
        </ul>
      </div>

      <div className="schema-note">
        <h3>Debug Stats</h3>
        <ul>
          <li>Firestore docs found: {docCount}</li>
          <li>Docs shown on page: {shownCount}</li>
          <li>Docs disabled/hidden: {disabledCount}</li>
        </ul>
      </div>

      {error && <p style={{ color: '#bb1e14' }}>Firestore error: {error}</p>}
    </section>
  );
}
