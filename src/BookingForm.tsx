import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, runTransaction, where, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { FirebaseError } from 'firebase/app';
import { db, storage } from './firebase';
import { DETAIL_PACKAGES, getDetailPackageKey, type DetailPackageKey } from './detailPackages';

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

type PackageOption = { key: DetailPackageKey; label: string; price: number };

const DEFAULT_PACKAGES: PackageOption[] = DETAIL_PACKAGES.map((item) => ({
  key: item.key,
  label: item.title,
  price: item.price,
}));

type VerifiedProfile = {
  fullName: string;
  phone: string;
  address: string;
};

function isWeekendDate(dateValue: string) {
  const day = new Date(`${dateValue}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

function getDailyCapacity(dateValue: string) {
  return isWeekendDate(dateValue) ? 2 : 1;
}

function getScheduleSlots(dateValue: string): string[] {
  if (!dateValue) return [];
  return isWeekendDate(dateValue) ? ['08:00', '13:00'] : ['16:00'];
}

function formatTimeLabel(timeValue: string): string {
  const [hourText, minuteText] = timeValue.split(':');
  const hour = Number(hourText);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour}:${minuteText} ${suffix}`;
}

function getUpcomingDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const end = new Date(today);
  end.setFullYear(end.getFullYear() + 1);

  const current = new Date(today);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function formatCalendarDate(dateValue: string): { top: string; bottom: string; openText: string } {
  const date = new Date(`${dateValue}T12:00:00`);
  return {
    top: date.toLocaleDateString(undefined, { weekday: 'short' }),
    bottom: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    openText: isWeekendDate(dateValue) ? '2 cars' : '1 car',
  };
}

function getMonthPages(dates: string[]) {
  const byMonth = new Map<string, string[]>();

  dates.forEach((dateValue) => {
    const key = dateValue.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(dateValue);
  });

  return Array.from(byMonth.entries()).map(([key, values]) => {
    const monthDate = new Date(`${key}-01T12:00:00`);
    const leadingBlankDays = monthDate.getDay();
    const cells: Array<string | null> = Array.from({ length: leadingBlankDays }, () => null);
    values.forEach((value) => cells.push(value));

    return {
      key,
      title: monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      cells,
    };
  });
}

export default function BookingForm({ user }: { user: User }) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [profile, setProfile] = useState<VerifiedProfile | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [bookedCounts, setBookedCounts] = useState<Record<string, number>>({});
  const [bookedTimesByDate, setBookedTimesByDate] = useState<Record<string, string[]>>({});
  const [loadingBookedDates, setLoadingBookedDates] = useState(true);
  const [packages, setPackages] = useState<PackageOption[]>(DEFAULT_PACKAGES);
  const upcomingDates = useMemo(() => getUpcomingDates(), []);
  const monthPages = useMemo(() => getMonthPages(upcomingDates), [upcomingDates]);
  const [monthIndex, setMonthIndex] = useState(0);
  const availableSlots = useMemo(() => {
    const taken = new Set(bookedTimesByDate[form.date] ?? []);
    return getScheduleSlots(form.date).filter((slot) => !taken.has(slot));
  }, [form.date, bookedTimesByDate]);

  useEffect(() => {
    let alive = true;
    const loadPrices = async () => {
      try {
        const snap = await getDocs(collection(db, 'pricing'));
        const overrides = new Map<DetailPackageKey, { label: string; price: number }>();
        snap.docs.forEach((d) => {
          const data = d.data();
          const key = getDetailPackageKey(String(data.detailName ?? data.name ?? ''));
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
        const [lockSnapshot, bookingSnapshot] = await Promise.all([
          getDocs(collection(db, 'bookingLocks')),
          getDocs(
            query(
              collection(db, 'bookings'),
              where('status', 'in', ['pending', 'approved'])
            )
          ),
        ]);

        const counts: Record<string, number> = {};
        const timesByDate: Record<string, string[]> = {};

        lockSnapshot.docs.forEach((entry) => {
          const data = entry.data();
          const date = String(data.date ?? '');
          const status = String(data.status ?? 'pending').toLowerCase();
          if (!date || status === 'cancelled') return;

          const count = Number(data.count ?? 0);
          if (count > 0) {
            counts[date] = Math.max(counts[date] ?? 0, count);
          }

          if (Array.isArray(data.times)) {
            timesByDate[date] = Array.from(new Set(data.times.map((item) => String(item))));
          }
        });

        bookingSnapshot.docs.forEach((entry) => {
          const data = entry.data();
          const date = String(data.date ?? '');
          const time = String(data.time ?? '');
          if (!date) return;

          counts[date] = (counts[date] ?? 0) + 1;
          if (time) {
            timesByDate[date] = Array.from(new Set([...(timesByDate[date] ?? []), time]));
          }
        });

        if (alive) {
          setBookedCounts(counts);
          setBookedTimesByDate(timesByDate);
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

  useEffect(() => {
    if (form.time && !availableSlots.includes(form.time)) {
      setForm((prev) => ({ ...prev, time: '' }));
    }
  }, [availableSlots, form.time]);

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

    if (!availableSlots.includes(time)) {
      setErrorMsg('Please choose one of the available schedule times.');
      return;
    }

    if ((bookedCounts[date] ?? 0) >= getDailyCapacity(date)) {
      setErrorMsg('That day is already full. Please choose another day.');
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

      const bookingRef = doc(collection(db, 'bookings'));
      const lockRef = doc(db, 'bookingLocks', date);

      await runTransaction(db, async (tx) => {
        const lockSnap = await tx.get(lockRef);
        const capacity = getDailyCapacity(date);
        const existingCount = Number(lockSnap.data()?.count ?? 0);
        const existingTimes = Array.isArray(lockSnap.data()?.times)
          ? lockSnap.data()!.times.map((item: unknown) => String(item))
          : [];

        if (existingCount >= capacity || existingTimes.includes(time)) {
          throw new Error('date-booked');
        }

        tx.set(bookingRef, {
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

        tx.set(lockRef, {
          date,
          bookingId: bookingRef.id,
          bookedByUid: user.uid,
          status: 'pending',
          count: existingCount + 1,
          times: [...existingTimes, time],
          updatedAt: serverTimestamp(),
          createdAt: lockSnap.exists() ? lockSnap.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
        }, { merge: true });
      });

      setBookedCounts((prev) => ({
        ...prev,
        [date]: (prev[date] ?? 0) + 1,
      }));
      setBookedTimesByDate((prev) => ({
        ...prev,
        [date]: Array.from(new Set([...(prev[date] ?? []), time])),
      }));
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
      } else if (err instanceof Error && err.message === 'date-booked') {
        setErrorMsg('That slot was just taken or the day is full. Please choose another option.');
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

      <div className="booking-scheduler-card">
        <div className="booking-scheduler-head">
          <strong>Schedule *</strong>
          <span>Weekdays: 1 car at 4PM • Weekends: 2 cars at 8AM and 1PM</span>
        </div>

        <div className="booking-month-nav">
          <button
            type="button"
            onClick={() => setMonthIndex((prev) => Math.max(0, prev - 1))}
            disabled={monthIndex === 0}
          >
            ← Prev
          </button>
          <strong>{monthPages[monthIndex]?.title}</strong>
          <button
            type="button"
            onClick={() => setMonthIndex((prev) => Math.min(monthPages.length - 1, prev + 1))}
            disabled={monthIndex === monthPages.length - 1}
          >
            Next →
          </button>
        </div>

        <div className="booking-weekdays-row">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="booking-calendar-grid">
          {(monthPages[monthIndex]?.cells ?? []).map((dateValue, index) => {
            if (!dateValue) {
              return <div key={`blank-${index}`} className="schedule-day-empty" />;
            }

            const info = formatCalendarDate(dateValue);
            const bookedCount = bookedCounts[dateValue] ?? 0;
            const capacity = getDailyCapacity(dateValue);
            const remaining = Math.max(0, capacity - bookedCount);
            const isBooked = remaining === 0;
            const isSelected = form.date === dateValue;

            return (
              <button
                key={dateValue}
                type="button"
                className={`schedule-day-btn${isSelected ? ' selected' : ''}${isBooked ? ' booked' : ''}`}
                onClick={() => {
                  if (isBooked) return;
                  setForm((prev) => ({
                    ...prev,
                    date: dateValue,
                    time: prev.date === dateValue ? prev.time : '',
                  }));
                  setErrorMsg('');
                }}
                disabled={loadingBookedDates || isBooked}
              >
                <span>{info.top}</span>
                <strong>{new Date(`${dateValue}T12:00:00`).getDate()}</strong>
                <small>{isBooked ? 'Full' : `${remaining} left`}</small>
              </button>
            );
          })}
        </div>

        {form.date && (
          <>
            <p className="booking-slot-label">
              Available times for {formatCalendarDate(form.date).bottom}
            </p>
            <div className="booking-slot-grid">
              {availableSlots.length === 0 ? (
                <p className="dash-error">No time slots left for this date.</p>
              ) : (
                availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={`schedule-slot-btn${form.time === slot ? ' selected' : ''}`}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, time: slot }));
                      setErrorMsg('');
                    }}
                  >
                    {formatTimeLabel(slot)}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {form.date && (bookedCounts[form.date] ?? 0) >= getDailyCapacity(form.date) && (
        <p style={{ color: '#c0392b', fontSize: '0.85rem', margin: 0 }}>
          ⚠ This day is already full. Please choose another day.
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

      <div className="booking-selected-summary">
        <span>Selected day: {form.date ? formatCalendarDate(form.date).bottom : 'None'}</span>
        <span>Selected time: {form.time ? formatTimeLabel(form.time) : 'None'}</span>
      </div>

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
