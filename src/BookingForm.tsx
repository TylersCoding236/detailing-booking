import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';

type Status = 'idle' | 'saving' | 'saved' | 'error';

interface FormState {
  date: string;
  time: string;
  notes: string;
}

const EMPTY: FormState = {
  date: '',
  time: '',
  notes: '',
};

type VerifiedProfile = {
  fullName: string;
  phone: string;
  address: string;
};

export default function BookingForm({ user }: { user: User }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [profile, setProfile] = useState<VerifiedProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    let alive = true;
    const loadProfile = async () => {
      setCheckingProfile(true);
      setErrorMsg('');
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data();
        const fullName = String(data?.fullName ?? data?.name ?? '').trim();
        const phone = String(data?.phone ?? '').trim();
        const address = String(data?.address ?? '').trim();
        const verifiedProfile = Boolean(data?.verifiedProfile);

        if (!fullName || !phone || !address || !verifiedProfile) {
          if (alive) setProfile(null);
        } else if (alive) {
          setProfile({ fullName, phone, address });
        }
      } catch {
        if (alive) {
          setProfile(null);
          setErrorMsg('Could not load your account profile. Please try again.');
        }
      } finally {
        if (alive) setCheckingProfile(false);
      }
    };
    loadProfile();
    return () => {
      alive = false;
    };
  }, [user.uid]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (status !== 'idle') {
      setStatus('idle');
    }
    if (errorMsg) {
      setErrorMsg('');
    }
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg('');

    if (!profile) {
      setErrorMsg('Please verify your account details before booking.');
      return;
    }

    const date = form.date.trim();
    const time = form.time.trim();
    const notes = form.notes.trim();

    if (!date || !time) {
      setErrorMsg('Date and time are required.');
      return;
    }

    setStatus('saving');
    try {
      await addDoc(collection(db, 'bookings'), {
        customerName: profile.fullName,
        phone: profile.phone,
        address: profile.address,
        date,
        time,
        notes,
        bookedByUid: user.uid,
        bookedByEmail: user.email ?? '',
        bookedByName: profile.fullName,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setStatus('saved');
      setForm(EMPTY);
    } catch (err) {
      console.error('Firestore write error:', err);
      if (err instanceof FirebaseError) {
        if (err.code === 'permission-denied') {
          setErrorMsg('Booking failed: Firestore rules blocked the write. Publish the rules from firestore.rules in Firebase Console.');
        } else if (err.code === 'failed-precondition') {
          setErrorMsg('Booking failed: Firestore database is not fully set up yet in Firebase Console.');
        } else if (err.code === 'invalid-argument') {
          setErrorMsg('Booking failed: invalid booking data was sent to Firestore.');
        } else {
          setErrorMsg(`Booking failed: ${err.code}`);
        }
      } else {
        setErrorMsg('Booking failed. Please try again.');
      }
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {checkingProfile ? (
        <p style={{ margin: 0 }}>Loading your account details...</p>
      ) : profile ? (
        <div className="booking-account-card">
          <strong>Booking Account</strong>
          <p>{profile.fullName}</p>
          <p>{user.email}</p>
          <p>{profile.phone}</p>
          <p>{profile.address}</p>
        </div>
      ) : (
        <div className="booking-verify-card">
          <p>
            Your account is not verified yet. Add your full name, phone number,
            and address first.
          </p>
          <a className="primary-btn" href="#/verify-account">
            Verify Account
          </a>
        </div>
      )}

      <label>
        Date *
        <input
          name="date"
          type="date"
          value={form.date}
          onChange={handleChange}
        />
      </label>

      <label>
        Time *
        <input
          name="time"
          type="time"
          value={form.time}
          onChange={handleChange}
        />
      </label>

      <label>
        Notes (optional)
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          placeholder="Any special requests or vehicle details?"
        />
      </label>

      {errorMsg && (
        <p role="alert" style={{ color: '#bb1e14', margin: 0 }}>
          {errorMsg}
        </p>
      )}

      {status === 'saved' && (
        <p style={{ color: '#1f7a4b', margin: 0 }}>
          ✓ Booking submitted! We'll be in touch soon.
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'saving' || !profile || checkingProfile}
      >
        {status === 'saving' ? 'Submitting…' : 'Book Appointment'}
      </button>
    </form>
  );
}
