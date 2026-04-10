import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';

interface VerifyAccountPageProps {
  user: User;
  onVerified: (fullName: string) => void;
}

function mapError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === 'permission-denied') {
      return 'Save failed: Firestore rules blocked the update.';
    }
    return `Save failed: ${err.code}`;
  }
  return 'Save failed. Please try again.';
}

export default function VerifyAccountPage({ user, onVerified }: VerifyAccountPageProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!alive || !snap.exists()) return;
        const data = snap.data();
        setFullName(String(data.fullName ?? data.name ?? ''));
        setPhone(String(data.phone ?? ''));
        setAddress(String(data.address ?? ''));
        setIsVerified(Boolean(data.verifiedProfile));
      } catch {
        // Keep defaults if profile can't be loaded.
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [user.uid]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedAddress = address.trim();

    if (!trimmedName || !trimmedPhone || !trimmedAddress) {
      setError('Full name, phone number, and address are all required.');
      return;
    }

    setBusy(true);
    try {
      const ref = doc(db, 'users', user.uid);
      const existing = await getDoc(ref);

      if (existing.exists()) {
        await updateDoc(ref, {
          name: trimmedName,
          fullName: trimmedName,
          phone: trimmedPhone,
          address: trimmedAddress,
          verifiedProfile: true,
          verifiedAt: serverTimestamp(),
        });
      } else {
        await setDoc(ref, {
          uid: user.uid,
          email: user.email ?? '',
          role: 'Standard',
          name: trimmedName,
          fullName: trimmedName,
          phone: trimmedPhone,
          address: trimmedAddress,
          verifiedProfile: true,
          createdAt: serverTimestamp(),
          verifiedAt: serverTimestamp(),
        });
      }

      onVerified(trimmedName);
      setIsVerified(true);
      setSuccess(
        'Booking details saved. Your future bookings will use this account info automatically.'
      );
      window.location.hash = '#/book-now';
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel fade-in verify-account-page">
      <div className="verify-head">
        <h2>{isVerified ? 'Edit Booking Details' : 'Verify Account'}</h2>
        <p>
          {isVerified
            ? 'Update the details used whenever you create a booking.'
            : 'Fill out your account details once. Future bookings will use this info automatically.'}
        </p>
      </div>

      <form className="verify-form" onSubmit={handleSubmit}>
        <label>
          Full Name
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
          />
        </label>

        <label>
          Phone Number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </label>

        <label>
          Address
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, city, state, zip"
          />
        </label>

        <button type="submit" disabled={busy}>
          {busy ? 'Saving...' : isVerified ? 'Save Booking Details' : 'Verify Account'}
        </button>
      </form>

      {error && <p className="verify-error">{error}</p>}
      {success && <p className="verify-success">{success}</p>}
    </section>
  );
}
