import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, addDoc, doc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { FirebaseError } from 'firebase/app';
import { db, storage } from './firebase';

type Status = 'idle' | 'saving' | 'saved' | 'error';

interface FormState {
  packageType: '' | 'exterior' | 'interior' | 'full';
  date: string;
  time: string;
  notes: string;
}

const EMPTY: FormState = {
  packageType: '',
  date: '',
  time: '',
  notes: '',
};

type PackageOption = { key: 'exterior' | 'interior' | 'full'; label: string; price: number };

const DEFAULT_PACKAGES: PackageOption[] = [
  { key: 'exterior', label: 'Exterior Refresh', price: 50 },
  { key: 'interior', label: 'Interior Reset', price: 50 },
  { key: 'full', label: 'Full Detail', price: 70 },
];

function getPackageKey(name: string): 'exterior' | 'interior' | 'full' | null {
  const v = name.toLowerCase();
  if (v.includes('exterior')) return 'exterior';
  if (v.includes('interior')) return 'interior';
  if (v.includes('full')) return 'full';
  return null;
}

type VerifiedProfile = {
  fullName: string;
  phone: string;
  address: string;
};

export default function BookingForm({ user }: { user: User }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [profile, setProfile] = useState<VerifiedProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [loadingBookedDates, setLoadingBookedDates] = useState(true);
  const [packages, setPackages] = useState<PackageOption[]>(DEFAULT_PACKAGES);

  useEffect(() => {
    let alive = true;
    const loadPrices = async () => {
      try {
        const snap = await getDocs(collection(db, 'pricing'));
        const overrides = new Map<'exterior' | 'interior' | 'full', { label: string; price: number }>();
        snap.docs.forEach((d) => {
          const data = d.data();
          const key = getPackageKey(String(data.detailName ?? data.name ?? ''));
          if (!key) return;
          const price = typeof data.price === 'number' ? data.price : null;
          const label = String(data.detailName ?? data.name ?? '').trim();
          if (price !== null && label) {
            overrides.set(key, { label, price });
          }
        });
        if (alive && overrides.size > 0) {
          setPackages(
            DEFAULT_PACKAGES.map((p) =>
              overrides.has(p.key) ? { ...p, ...overrides.get(p.key)! } : p
            )
          );
        }
      } catch {
        // fall back to defaults silently
      }
    };
    loadPrices();
    return () => {
      alive = false;
    };
  }, []);

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

  useEffect(() => {
    let alive = true;
    const loadBookedDates = async () => {
      setLoadingBookedDates(true);
      try {
        const q = query(
          collection(db, 'bookings'),
          where('status', 'in', ['pending', 'approved'])
        );
        const snapshot = await getDocs(q);
        const dates = new Set<string>();
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.date) {
            dates.add(String(data.date));
          }
        });
        if (alive) {
          setBookedDates(dates);
        }
      } catch (err) {
        console.error('Error loading booked dates:', err);
      } finally {
        if (alive) {
          setLoadingBookedDates(false);
        }
      }
    };
    loadBookedDates();
    return () => {
      alive = false;
    };
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    if (status !== 'idle') {
      setStatus('idle');
    }
    if (errorMsg) {
      setErrorMsg('');
    }
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (status !== 'idle') setStatus('idle');
    if (errorMsg) setErrorMsg('');

    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPhotoFile(null);
      setPhotoPreviewUrl('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file for the car photo.');
      setPhotoFile(null);
      setPhotoPreviewUrl('');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('Image is too large. Please upload a file under 8MB.');
      setPhotoFile(null);
      setPhotoPreviewUrl('');
      return;
    }

    setPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPhotoPreviewUrl(objectUrl);
  }

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg('');

    if (!profile) {
      setErrorMsg('Please verify your account details before booking.');
      return;
    }

    const packageType = form.packageType;
    const date = form.date.trim();
    const time = form.time.trim();
    const notes = form.notes.trim();

    if (!packageType) {
      setErrorMsg('Please choose a package.');
      return;
    }

    if (!date || !time) {
      setErrorMsg('Package, date, and time are required.');
      return;
    }

    if (bookedDates.has(date)) {
      setErrorMsg('That date is already booked. Please choose another date.');
      return;
    }

    if (!photoFile) {
      setErrorMsg('Please upload a car photo so pricing can be reviewed.');
      return;
    }

    setStatus('saving');
    try {
      const selectedPkg = packages.find((p) => p.key === packageType) ?? { label: packageType, price: 0 };
      const safeName = photoFile.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const storageRef = ref(
        storage,
        `bookingPhotos/${user.uid}/${Date.now()}-${safeName}`
      );
      await uploadBytes(storageRef, photoFile);
      const carPhotoUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, 'bookings'), {
        customerName: profile.fullName,
        phone: profile.phone,
        address: profile.address,
        packageType,
        packageLabel: selectedPkg.label,
        basePrice: selectedPkg.price,
        date,
        time,
        notes,
        carPhotoUrl,
        bookedByUid: user.uid,
        bookedByEmail: user.email ?? '',
        bookedByName: profile.fullName,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setStatus('saved');
      setForm(EMPTY);
      setPhotoFile(null);
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
      setPhotoPreviewUrl('');
    } catch (err) {
      console.error('Firestore write error:', err);
      if (err instanceof FirebaseError) {
        if (err.code === 'permission-denied') {
          setErrorMsg('Booking failed: Firebase rules blocked the upload or booking write.');
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
        Package *
        <select
          name="packageType"
          value={form.packageType}
          onChange={handleChange}
        >
          <option value="">Select a package</option>
          {packages.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label} — ${p.price}
            </option>
          ))}
        </select>
      </label>

      <label>
        Date *
        <input
          name="date"
          type="date"
          value={form.date}
          onChange={handleChange}
          disabled={loadingBookedDates}
          style={
            form.date && bookedDates.has(form.date)
              ? { borderColor: '#c0392b', backgroundColor: '#ffe5e1' }
              : undefined
          }
        />
      </label>
      {form.date && bookedDates.has(form.date) && (
        <p style={{ color: '#c0392b', fontSize: '0.85rem', margin: 0 }}>
          ⚠ This date is already booked. Please choose another date.
        </p>
      )}

      <label>
        Car Photo *
        <input
          name="carPhoto"
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
        />
      </label>

      {photoPreviewUrl && (
        <img
          src={photoPreviewUrl}
          alt="Car preview"
          className="booking-photo-preview"
        />
      )}

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
