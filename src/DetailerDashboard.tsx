import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';
import { DETAIL_PACKAGES, getDetailPackageKey } from './detailPackages';

type DashTab =
  | 'bookings'
  | 'photos'
  | 'users'
  | 'admin'
  | 'prices'
  | 'gallery'
  | 'reviews'
  | 'news';

type Booking = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  packageType: string;
  packageLabel: string;
  basePrice: number | null;
  carPhotoUrl: string;
  bookedByUid: string;
  bookedByEmail: string;
  date: string;
  time: string;
  status: string;
  notes: string;
};

type UserRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  verifiedProfile: boolean;
};

type PricingItem = {
  id: string;
  name: string;
  price: string;
  priceValue: number | null;
  description: string;
  isEnabled: boolean;
  isSpecialOffer: boolean;
};

type GalleryItem = {
  id: string;
  title: string;
  imageUrl: string;
  tone: string;
  sortOrder: number;
  isFeatured: boolean;
  isEnabled: boolean;
};

type ReviewItem = {
  id: string;
  name: string;
  text: string;
  rating: number;
  isEnabled: boolean;
};

type NewsItem = {
  id: string;
  title: string;
  version: string;
  body: string;
  isEnabled: boolean;
};

type BookingEditForm = {
  date: string;
  time: string;
  status: string;
  notes: string;
};

type PriceCreateForm = {
  name: string;
  price: string;
  description: string;
  isEnabled: boolean;
  isSpecialOffer: boolean;
};

type PriceEditForm = {
  name: string;
  price: string;
  description: string;
};

type GalleryForm = {
  title: string;
  imageUrl: string;
  tone: string;
  sortOrder: string;
  isFeatured: boolean;
  isEnabled: boolean;
};

type ReviewForm = {
  name: string;
  text: string;
  rating: string;
  isEnabled: boolean;
};

type NewsForm = {
  title: string;
  version: string;
  body: string;
  isEnabled: boolean;
};

function toBooking(id: string, data: DocumentData): Booking {
  const rawBasePrice = data.basePrice;
  return {
    id,
    customerName: String(data.customerName ?? ''),
    phone: String(data.phone ?? ''),
    address: String(data.address ?? ''),
    packageType: String(data.packageType ?? ''),
    packageLabel: String(data.packageLabel ?? ''),
    basePrice: typeof rawBasePrice === 'number' ? rawBasePrice : null,
    carPhotoUrl: String(data.carPhotoUrl ?? ''),
    bookedByUid: String(data.bookedByUid ?? ''),
    bookedByEmail: String(data.bookedByEmail ?? ''),
    date: String(data.date ?? ''),
    time: String(data.time ?? ''),
    status: String(data.status ?? 'pending'),
    notes: String(data.notes ?? ''),
  };
}

function toUserRecord(id: string, data: DocumentData): UserRecord {
  return {
    id,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    role: String(data.role ?? ''),
    verifiedProfile: Boolean(data.verifiedProfile),
  };
}

function toPricingItem(id: string, data: DocumentData): PricingItem {
  const rawPrice = data.price ?? data.Price ?? data.cost;
  const priceValue = typeof rawPrice === 'number' ? rawPrice : null;
  const price =
    typeof rawPrice === 'number'
      ? `$${rawPrice.toFixed(2)}`
      : String(rawPrice ?? '');

  return {
    id,
    name: String(data.detailName ?? data.name ?? data.serviceName ?? ''),
    price,
    priceValue,
    description: String(data.description ?? data.desc ?? ''),
    isEnabled: data.isEnabled !== false,
    isSpecialOffer: Boolean(data.isSpecialOffer ?? data.specialOffer),
  };
}

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

function toReviewItem(id: string, data: DocumentData): ReviewItem {
  return {
    id,
    name: String(data.name ?? ''),
    text: String(data.text ?? ''),
    rating: Number(data.rating ?? 5),
    isEnabled: data.isEnabled !== false,
  };
}

function toNewsItem(id: string, data: DocumentData): NewsItem {
  return {
    id,
    title: String(data.title ?? ''),
    version: String(data.version ?? ''),
    body: String(data.body ?? ''),
    isEnabled: data.isEnabled !== false,
  };
}

function useCollection<T>(
  collectionName: string,
  mapper: (id: string, data: DocumentData) => T
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, collectionName),
      (snap) => {
        setItems(snap.docs.map((d) => mapper(d.id, d.data())));
        setLoading(false);
      },
      (err) => {
        setError(
          err instanceof FirebaseError
            ? err.code
            : `Could not load ${collectionName}`
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, [collectionName, mapper]);

  return { items, loading, error };
}

function toNumberOrZero(value: string): number {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

function getDailyCapacity(dateValue: string): number {
  const day = new Date(`${dateValue}T12:00:00`).getDay();
  return day === 0 || day === 6 ? 2 : 1;
}

export default function DetailerDashboard({
  standardSiteAccess,
  onToggleStandardSiteAccess,
}: {
  standardSiteAccess: boolean;
  onToggleStandardSiteAccess: () => void;
}) {
  const [tab, setTab] = useState<DashTab>('bookings');

  const bookings = useCollection('bookings', toBooking);
  const users = useCollection('users', toUserRecord);
  const prices = useCollection('pricing', toPricingItem);
  const gallery = useCollection('galleryItems', toGalleryItem);
  const reviews = useCollection('reviews', toReviewItem);
  const news = useCollection('siteNews', toNewsItem);

  const [actionBusyId, setActionBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const [editingId, setEditingId] = useState('');
  const [editForm, setEditForm] = useState<BookingEditForm>({
    date: '',
    time: '',
    status: 'pending',
    notes: '',
  });

  const [createPriceBusy, setCreatePriceBusy] = useState(false);
  const [syncPriceBusy, setSyncPriceBusy] = useState(false);
  const [hasAutoSyncedPrices, setHasAutoSyncedPrices] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState('');
  const [priceEditBusy, setPriceEditBusy] = useState(false);
  const [priceEditForm, setPriceEditForm] = useState<PriceEditForm>({
    name: '',
    price: '',
    description: '',
  });

  const [showCreateGallery, setShowCreateGallery] = useState(false);
  const [editingGalleryId, setEditingGalleryId] = useState('');
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryCreateForm, setGalleryCreateForm] = useState<GalleryForm>({
    title: '',
    imageUrl: '',
    tone: 'warm',
    sortOrder: '0',
    isFeatured: false,
    isEnabled: true,
  });
  const [galleryEditForm, setGalleryEditForm] = useState<GalleryForm>({
    title: '',
    imageUrl: '',
    tone: 'warm',
    sortOrder: '0',
    isFeatured: false,
    isEnabled: true,
  });

  const [showCreateReview, setShowCreateReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewCreateForm, setReviewCreateForm] = useState<ReviewForm>({
    name: '',
    text: '',
    rating: '5',
    isEnabled: true,
  });
  const [reviewEditForm, setReviewEditForm] = useState<ReviewForm>({
    name: '',
    text: '',
    rating: '5',
    isEnabled: true,
  });

  const [showCreateNews, setShowCreateNews] = useState(false);
  const [editingNewsId, setEditingNewsId] = useState('');
  const [newsBusy, setNewsBusy] = useState(false);
  const [newsCreateForm, setNewsCreateForm] = useState<NewsForm>({
    title: '',
    version: '',
    body: '',
    isEnabled: true,
  });
  const [newsEditForm, setNewsEditForm] = useState<NewsForm>({
    title: '',
    version: '',
    body: '',
    isEnabled: true,
  });

  const adminStats = useMemo(() => {
    const totalBookings = bookings.items.length;
    const pendingBookings = (bookings.items as Booking[]).filter(
      (b) => b.status.toLowerCase() === 'pending'
    ).length;
    const approvedBookings = (bookings.items as Booking[]).filter(
      (b) => b.status.toLowerCase() === 'approved'
    ).length;
    const verifiedUsers = (users.items as UserRecord[]).filter(
      (u) => u.verifiedProfile
    ).length;

    return {
      totalBookings,
      pendingBookings,
      approvedBookings,
      totalUsers: users.items.length,
      verifiedUsers,
      totalPrices: prices.items.length,
      totalGallery: gallery.items.length,
      totalReviews: reviews.items.length,
      totalNews: news.items.length,
    };
  }, [bookings.items, users.items, prices.items, gallery.items, reviews.items, news.items]);

  const tabData =
    tab === 'bookings'
      ? bookings
      : tab === 'users'
      ? users
      : tab === 'prices'
      ? prices
      : tab === 'gallery'
      ? gallery
      : tab === 'reviews'
      ? reviews
      : tab === 'news'
      ? news
      : null;

  function resetActionMessages() {
    setActionError('');
    setActionSuccess('');
  }

  function startEditBooking(booking: Booking) {
    resetActionMessages();
    setEditingId(booking.id);
    setEditForm({
      date: booking.date,
      time: booking.time,
      status: booking.status || 'pending',
      notes: booking.notes || '',
    });
  }

  function cancelEditBooking() {
    setEditingId('');
    setEditForm({ date: '', time: '', status: 'pending', notes: '' });
  }

  async function approveBooking(bookingId: string) {
    resetActionMessages();
    setActionBusyId(bookingId);
    const bookingRow = (bookings.items as Booking[]).find((b) => b.id === bookingId);
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'approved',
        approvedAt: serverTimestamp(),
      });
      if (bookingRow?.date) {
        await updateDoc(doc(db, 'bookingLocks', bookingRow.date), {
          status: 'approved',
          updatedAt: serverTimestamp(),
        });
      }
      setActionSuccess('Booking approved.');
    } catch (err) {
      setActionError(
        err instanceof FirebaseError
          ? `Approve failed: ${err.code}`
          : 'Approve failed.'
      );
    } finally {
      setActionBusyId('');
    }
  }

  async function saveBookingEdit(bookingId: string) {
    resetActionMessages();

    const nextDate = editForm.date.trim();
    const nextTime = editForm.time.trim();
    const nextStatus = editForm.status.trim().toLowerCase();
    const bookingRow = (bookings.items as Booking[]).find((b) => b.id === bookingId);

    if (!nextDate || !nextTime || !nextStatus) {
      setActionError('Date, time, and status are required.');
      return;
    }

    if (!bookingRow) {
      setActionError('Booking not found. Please refresh and try again.');
      return;
    }

    setActionBusyId(bookingId);
    try {
      await runTransaction(db, async (tx) => {
        const bookingRef = doc(db, 'bookings', bookingId);
        const oldLockRef = doc(db, 'bookingLocks', bookingRow.date);
        const newLockRef = doc(db, 'bookingLocks', nextDate);
        const oldStatus = String(bookingRow.status ?? 'pending').toLowerCase();
        const oldBlocksDay = oldStatus !== 'cancelled';
        const newBlocksDay = nextStatus !== 'cancelled';

        const oldLockSnap = await tx.get(oldLockRef);
        const newLockSnap = bookingRow.date === nextDate ? oldLockSnap : await tx.get(newLockRef);

        tx.update(bookingRef, {
          date: nextDate,
          time: nextTime,
          status: nextStatus,
          notes: editForm.notes.trim(),
          updatedAt: serverTimestamp(),
        });

        if (newBlocksDay) {
          const currentCount = Number(newLockSnap.data()?.count ?? 0);
          const currentTimes = Array.isArray(newLockSnap.data()?.times)
            ? newLockSnap.data()!.times.map((item: unknown) => String(item))
            : [];
          const adjustedCount = bookingRow.date === nextDate && oldBlocksDay ? Math.max(0, currentCount - 1) : currentCount;
          const adjustedTimes = bookingRow.date === nextDate && oldBlocksDay
            ? currentTimes.filter((item: string) => item !== bookingRow.time)
            : currentTimes;

          if (adjustedCount >= getDailyCapacity(nextDate) || adjustedTimes.includes(nextTime)) {
            throw new Error('date-booked');
          }
        }

        if (oldBlocksDay) {
          const currentCount = Number(oldLockSnap.data()?.count ?? 0);
          const currentTimes: string[] = Array.isArray(oldLockSnap.data()?.times)
            ? oldLockSnap.data()!.times.map((item: unknown) => String(item))
            : [];
          const nextCount = Math.max(0, currentCount - 1);
          const nextTimes = currentTimes.filter((item) => item !== bookingRow.time);

          if ((bookingRow.date !== nextDate || !newBlocksDay) && currentCount > 0) {
            if (nextCount === 0) {
              tx.delete(oldLockRef);
            } else {
              tx.set(oldLockRef, {
                date: bookingRow.date,
                bookingId,
                bookedByUid: bookingRow.bookedByUid,
                status: 'pending',
                count: nextCount,
                times: nextTimes,
                updatedAt: serverTimestamp(),
              }, { merge: true });
            }
          }
        }

        if (newBlocksDay) {
          const currentCount = Number(newLockSnap.data()?.count ?? 0);
          const currentTimes = Array.isArray(newLockSnap.data()?.times)
            ? newLockSnap.data()!.times.map((item: unknown) => String(item))
            : [];
          const baseCount = bookingRow.date === nextDate && oldBlocksDay ? Math.max(0, currentCount - 1) : currentCount;
          const baseTimes = bookingRow.date === nextDate && oldBlocksDay
            ? currentTimes.filter((item: string) => item !== bookingRow.time)
            : currentTimes;

          tx.set(newLockRef, {
            date: nextDate,
            bookingId,
            bookedByUid: bookingRow.bookedByUid,
            status: nextStatus,
            count: baseCount + 1,
            times: Array.from(new Set([...baseTimes, nextTime])),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      });
      setActionSuccess('Booking updated.');
      cancelEditBooking();
    } catch (err) {
      if (err instanceof Error && err.message === 'date-booked') {
        setActionError('That date is already booked. Choose a different date.');
      } else {
      setActionError(
        err instanceof FirebaseError
          ? `Edit failed: ${err.code}`
          : 'Edit failed.'
      );
      }
    } finally {
      setActionBusyId('');
    }
  }

  async function deleteBooking(bookingId: string) {
    resetActionMessages();
    setActionBusyId(bookingId);
    const bookingRow = (bookings.items as Booking[]).find((b) => b.id === bookingId);

    if (!bookingRow) {
      setActionError('Booking not found. Please refresh and try again.');
      setActionBusyId('');
      return;
    }

    try {
      await runTransaction(db, async (tx) => {
        const bookingRef = doc(db, 'bookings', bookingId);
        const lockRef = doc(db, 'bookingLocks', bookingRow.date);
        const lockSnap = await tx.get(lockRef);

        tx.delete(bookingRef);

        if (String(bookingRow.status ?? 'pending').toLowerCase() !== 'cancelled' && lockSnap.exists()) {
          const currentCount = Number(lockSnap.data()?.count ?? 0);
          const currentTimes: string[] = Array.isArray(lockSnap.data()?.times)
            ? lockSnap.data()!.times.map((item: unknown) => String(item))
            : [];
          const nextCount = Math.max(0, currentCount - 1);
          const nextTimes = currentTimes.filter((item: string) => item !== bookingRow.time);

          if (nextCount === 0) {
            tx.delete(lockRef);
          } else {
            tx.set(lockRef, {
              date: bookingRow.date,
              bookingId,
              bookedByUid: bookingRow.bookedByUid,
              status: 'pending',
              count: nextCount,
              times: nextTimes,
              updatedAt: serverTimestamp(),
            }, { merge: true });
          }
        }
      });
      if (editingId === bookingId) cancelEditBooking();
      setActionSuccess('Booking removed.');
    } catch (err) {
      setActionError(
        err instanceof FirebaseError
          ? `Delete failed: ${err.code}`
          : 'Delete failed.'
      );
    } finally {
      setActionBusyId('');
    }
  }

  const HOME_PAGE_PRICE_PACKAGES = DETAIL_PACKAGES.map((item) => ({
    detailName: item.title,
    price: item.price,
    description: item.description,
    displayOrder: item.displayOrder,
  }));

  const canonicalPriceKeys = new Set(DETAIL_PACKAGES.map((item) => item.key));
  const currentPriceKeys = new Set(
    (prices.items as PricingItem[])
      .map((item) => getDetailPackageKey(item.name))
      .filter((value): value is NonNullable<ReturnType<typeof getDetailPackageKey>> => value !== null)
  );
  const priceSetMatchesHomePackages =
    prices.items.length === DETAIL_PACKAGES.length &&
    DETAIL_PACKAGES.every((item) => currentPriceKeys.has(item.key));

  async function replacePricesWithHomePackages() {
    setSyncPriceBusy(true);
    resetActionMessages();
    try {
      for (const price of prices.items as PricingItem[]) {
        await deleteDoc(doc(db, 'pricing', price.id));
      }

      for (const pkg of HOME_PAGE_PRICE_PACKAGES) {
        await addDoc(collection(db, 'pricing'), {
          ...pkg,
          isEnabled: true,
          isSpecialOffer: false,
          createdAt: serverTimestamp(),
        });
      }
      setActionSuccess('Pricing now matches the three home page packages.');
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Replace prices failed: ${err.code}` : 'Replace prices failed.'
      );
    } finally {
      setSyncPriceBusy(false);
    }
  }

  useEffect(() => {
    if (tab !== 'prices' || prices.loading || prices.error || syncPriceBusy || hasAutoSyncedPrices) {
      return;
    }

    if (!priceSetMatchesHomePackages) {
      setHasAutoSyncedPrices(true);
      void replacePricesWithHomePackages();
      return;
    }

    setHasAutoSyncedPrices(true);
  }, [
    tab,
    prices.loading,
    prices.error,
    syncPriceBusy,
    hasAutoSyncedPrices,
    priceSetMatchesHomePackages,
  ]);

  function beginEditPrice(price: PricingItem) {
    resetActionMessages();
    setEditingPriceId(price.id);
    setPriceEditForm({
      name: price.name,
      price: price.priceValue != null ? String(price.priceValue) : price.price.replace('$', ''),
      description: price.description,
    });
  }

  function cancelEditPrice() {
    setEditingPriceId('');
    setPriceEditForm({ name: '', price: '', description: '' });
  }

  async function savePriceEdit(priceId: string) {
    resetActionMessages();

    const name = priceEditForm.name.trim();
    const priceRaw = priceEditForm.price.trim();
    const description = priceEditForm.description.trim();

    if (!name || !priceRaw) {
      setActionError('Package name and price are required.');
      return;
    }

    const parsedPrice = Number(priceRaw);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setActionError('Price must be a valid positive number.');
      return;
    }

    setPriceEditBusy(true);
    try {
      await updateDoc(doc(db, 'pricing', priceId), {
        detailName: name,
        price: parsedPrice,
        description,
        updatedAt: serverTimestamp(),
      });
      setActionSuccess('Price package updated.');
      cancelEditPrice();
    } catch (err) {
      setActionError(
        err instanceof FirebaseError
          ? `Update price failed: ${err.code}`
          : 'Update price failed.'
      );
    } finally {
      setPriceEditBusy(false);
    }
  }

  async function togglePriceFlag(
    priceId: string,
    field: 'isEnabled' | 'isSpecialOffer',
    value: boolean
  ) {
    resetActionMessages();
    setActionBusyId(priceId);
    try {
      await updateDoc(doc(db, 'pricing', priceId), {
        [field]: value,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      setActionError(
        err instanceof FirebaseError
          ? `Toggle failed: ${err.code}`
          : 'Toggle failed.'
      );
    } finally {
      setActionBusyId('');
    }
  }

  async function createGalleryItem() {
    resetActionMessages();
    const title = galleryCreateForm.title.trim();
    const imageUrl = galleryCreateForm.imageUrl.trim();

    if (!title || !imageUrl) {
      setActionError('Gallery title and image URL are required.');
      return;
    }

    setGalleryBusy(true);
    try {
      await addDoc(collection(db, 'galleryItems'), {
        title,
        imageUrl,
        tone: galleryCreateForm.tone,
        sortOrder: toNumberOrZero(galleryCreateForm.sortOrder),
        isFeatured: galleryCreateForm.isFeatured,
        isEnabled: galleryCreateForm.isEnabled,
        createdAt: serverTimestamp(),
      });
      setGalleryCreateForm({
        title: '',
        imageUrl: '',
        tone: 'warm',
        sortOrder: '0',
        isFeatured: false,
        isEnabled: true,
      });
      setShowCreateGallery(false);
      setActionSuccess('Gallery item created.');
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Create gallery failed: ${err.code}` : 'Create gallery failed.'
      );
    } finally {
      setGalleryBusy(false);
    }
  }

  function beginEditGallery(item: GalleryItem) {
    resetActionMessages();
    setEditingGalleryId(item.id);
    setGalleryEditForm({
      title: item.title,
      imageUrl: item.imageUrl,
      tone: item.tone,
      sortOrder: String(item.sortOrder),
      isFeatured: item.isFeatured,
      isEnabled: item.isEnabled,
    });
  }

  function cancelEditGallery() {
    setEditingGalleryId('');
  }

  async function saveGalleryEdit(itemId: string) {
    resetActionMessages();
    const title = galleryEditForm.title.trim();
    const imageUrl = galleryEditForm.imageUrl.trim();

    if (!title || !imageUrl) {
      setActionError('Gallery title and image URL are required.');
      return;
    }

    setGalleryBusy(true);
    try {
      await updateDoc(doc(db, 'galleryItems', itemId), {
        title,
        imageUrl,
        tone: galleryEditForm.tone,
        sortOrder: toNumberOrZero(galleryEditForm.sortOrder),
        isFeatured: galleryEditForm.isFeatured,
        isEnabled: galleryEditForm.isEnabled,
        updatedAt: serverTimestamp(),
      });
      setActionSuccess('Gallery item updated.');
      cancelEditGallery();
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Update gallery failed: ${err.code}` : 'Update gallery failed.'
      );
    } finally {
      setGalleryBusy(false);
    }
  }

  async function deleteGalleryItem(itemId: string) {
    resetActionMessages();
    setActionBusyId(itemId);
    try {
      await deleteDoc(doc(db, 'galleryItems', itemId));
      setActionSuccess('Gallery item removed.');
      if (editingGalleryId === itemId) cancelEditGallery();
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Delete gallery failed: ${err.code}` : 'Delete gallery failed.'
      );
    } finally {
      setActionBusyId('');
    }
  }

  async function createReviewItem() {
    resetActionMessages();
    const name = reviewCreateForm.name.trim();
    const text = reviewCreateForm.text.trim();
    const rating = Number(reviewCreateForm.rating);

    if (!name || !text) {
      setActionError('Reviewer name and review text are required.');
      return;
    }

    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      setActionError('Rating must be between 1 and 5.');
      return;
    }

    setReviewBusy(true);
    try {
      await addDoc(collection(db, 'reviews'), {
        name,
        text,
        rating,
        isEnabled: reviewCreateForm.isEnabled,
        createdAt: serverTimestamp(),
      });
      setReviewCreateForm({ name: '', text: '', rating: '5', isEnabled: true });
      setShowCreateReview(false);
      setActionSuccess('Review item created.');
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Create review failed: ${err.code}` : 'Create review failed.'
      );
    } finally {
      setReviewBusy(false);
    }
  }

  function beginEditReview(item: ReviewItem) {
    resetActionMessages();
    setEditingReviewId(item.id);
    setReviewEditForm({
      name: item.name,
      text: item.text,
      rating: String(item.rating || 5),
      isEnabled: item.isEnabled,
    });
  }

  function cancelEditReview() {
    setEditingReviewId('');
  }

  async function saveReviewEdit(itemId: string) {
    resetActionMessages();
    const name = reviewEditForm.name.trim();
    const text = reviewEditForm.text.trim();
    const rating = Number(reviewEditForm.rating);

    if (!name || !text) {
      setActionError('Reviewer name and review text are required.');
      return;
    }

    if (Number.isNaN(rating) || rating < 1 || rating > 5) {
      setActionError('Rating must be between 1 and 5.');
      return;
    }

    setReviewBusy(true);
    try {
      await updateDoc(doc(db, 'reviews', itemId), {
        name,
        text,
        rating,
        isEnabled: reviewEditForm.isEnabled,
        updatedAt: serverTimestamp(),
      });
      setActionSuccess('Review item updated.');
      cancelEditReview();
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Update review failed: ${err.code}` : 'Update review failed.'
      );
    } finally {
      setReviewBusy(false);
    }
  }

  async function deleteReviewItem(itemId: string) {
    resetActionMessages();
    setActionBusyId(itemId);
    try {
      await deleteDoc(doc(db, 'reviews', itemId));
      setActionSuccess('Review item removed.');
      if (editingReviewId === itemId) cancelEditReview();
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Delete review failed: ${err.code}` : 'Delete review failed.'
      );
    } finally {
      setActionBusyId('');
    }
  }

  async function createNewsItem() {
    resetActionMessages();
    const title = newsCreateForm.title.trim();
    const body = newsCreateForm.body.trim();

    if (!title || !body) {
      setActionError('News title and body are required.');
      return;
    }

    setNewsBusy(true);
    try {
      await addDoc(collection(db, 'siteNews'), {
        title,
        version: newsCreateForm.version.trim(),
        body,
        isEnabled: newsCreateForm.isEnabled,
        createdAt: serverTimestamp(),
      });
      setNewsCreateForm({ title: '', version: '', body: '', isEnabled: true });
      setShowCreateNews(false);
      setActionSuccess('News item created.');
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Create news failed: ${err.code}` : 'Create news failed.'
      );
    } finally {
      setNewsBusy(false);
    }
  }

  function beginEditNews(item: NewsItem) {
    resetActionMessages();
    setEditingNewsId(item.id);
    setNewsEditForm({
      title: item.title,
      version: item.version,
      body: item.body,
      isEnabled: item.isEnabled,
    });
  }

  function cancelEditNews() {
    setEditingNewsId('');
  }

  async function saveNewsEdit(itemId: string) {
    resetActionMessages();
    const title = newsEditForm.title.trim();
    const body = newsEditForm.body.trim();

    if (!title || !body) {
      setActionError('News title and body are required.');
      return;
    }

    setNewsBusy(true);
    try {
      await updateDoc(doc(db, 'siteNews', itemId), {
        title,
        version: newsEditForm.version.trim(),
        body,
        isEnabled: newsEditForm.isEnabled,
        updatedAt: serverTimestamp(),
      });
      setActionSuccess('News item updated.');
      cancelEditNews();
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Update news failed: ${err.code}` : 'Update news failed.'
      );
    } finally {
      setNewsBusy(false);
    }
  }

  async function deleteNewsItem(itemId: string) {
    resetActionMessages();
    setActionBusyId(itemId);
    try {
      await deleteDoc(doc(db, 'siteNews', itemId));
      setActionSuccess('News item removed.');
      if (editingNewsId === itemId) cancelEditNews();
    } catch (err) {
      setActionError(
        err instanceof FirebaseError ? `Delete news failed: ${err.code}` : 'Delete news failed.'
      );
    } finally {
      setActionBusyId('');
    }
  }

  const isCreateTab = tab === 'gallery' || tab === 'reviews' || tab === 'news';

  return (
    <section className="panel fade-in dash-page">
      <div className="dash-header">
        <h2>Detailer Dashboard</h2>
      </div>

      <div className="dash-tabs">
        {(['bookings', 'photos', 'users', 'admin', 'prices', 'gallery', 'reviews', 'news'] as DashTab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`dash-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="dash-section">
        {tab !== 'admin' && tabData && (
          <div className="dash-section-top">
            <span className="dash-count">
              {tabData.loading ? '—' : tabData.items.length}{' '}
              {tab === 'bookings'
                ? 'booking'
                : tab === 'users'
                ? 'user'
                : tab === 'prices'
                ? 'price item'
                : tab === 'gallery'
                ? 'gallery item'
                : tab === 'reviews'
                ? 'review'
                : 'news item'}
              {!tabData.loading && tabData.items.length !== 1 ? 's' : ''}
            </span>

            {(isCreateTab || tab === 'prices') && (
              <div className="dash-actions">
                {tab === 'prices' && (
                  <button
                    className="dash-add-btn dash-add-btn--secondary"
                    type="button"
                    onClick={replacePricesWithHomePackages}
                    disabled={syncPriceBusy}
                  >
                    {syncPriceBusy ? 'Replacing...' : 'Use Home Page 3 Packages'}
                  </button>
                )}
                {isCreateTab && (
                  <button
                    className="dash-add-btn"
                    type="button"
                    onClick={() => {
                      if (tab === 'gallery') setShowCreateGallery((prev) => !prev);
                      if (tab === 'reviews') setShowCreateReview((prev) => !prev);
                      if (tab === 'news') setShowCreateNews((prev) => !prev);
                    }}
                  >
                    {tab === 'gallery' && (showCreateGallery ? 'Cancel' : 'Create Gallery Item')}
                    {tab === 'reviews' && (showCreateReview ? 'Cancel' : 'Create Review')}
                    {tab === 'news' && (showCreateNews ? 'Cancel' : 'Create News')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {actionError && <p className="dash-error">{actionError}</p>}
        {actionSuccess && <p className="dash-meta">{actionSuccess}</p>}

        {tab === 'bookings' && (
          <>
            {bookings.loading && <p className="dash-meta">Loading...</p>}
            {bookings.error && <p className="dash-error">{bookings.error}</p>}
            {!bookings.loading && !bookings.error && bookings.items.length === 0 && (
              <p className="dash-meta">No bookings found.</p>
            )}

            {!bookings.loading && !bookings.error && (
              <div className="dash-list">
                {(bookings.items as Booking[]).map((b) => (
                  <div className="dash-row" key={b.id}>
                    <div className="dash-row-info">
                      <strong>{b.customerName || '(no name)'}</strong>
                      <span>Account: {b.bookedByEmail || '(missing email)'}</span>
                      <span>User ID: {b.bookedByUid || '(missing uid)'}</span>
                      <span>
                        Package: {b.packageLabel || b.packageType || '(missing package)'}
                        {b.basePrice != null ? ` ($${b.basePrice})` : ''}
                      </span>
                      <span>{b.phone || '(missing phone)'}</span>
                      <span>{b.address || '(missing address)'}</span>
                      <span>{b.date} at {b.time}</span>
                      {b.carPhotoUrl && (
                        <a href={b.carPhotoUrl} target="_blank" rel="noreferrer">
                          View uploaded car photo
                        </a>
                      )}
                      {b.notes && <span className="dash-notes">{b.notes}</span>}
                    </div>
                    <div className="dash-row-right">
                      {b.carPhotoUrl && (
                        <a href={b.carPhotoUrl} target="_blank" rel="noreferrer">
                          <img className="dash-thumb" src={b.carPhotoUrl} alt="Car upload" />
                        </a>
                      )}
                      <span className="dash-badge">{b.status || 'pending'}</span>
                      <div className="dash-row-actions">
                        <button
                          type="button"
                          onClick={() => approveBooking(b.id)}
                          disabled={actionBusyId === b.id || b.status === 'approved'}
                        >
                          {actionBusyId === b.id ? 'Saving...' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditBooking(b)}
                          disabled={actionBusyId === b.id}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="dash-remove"
                          onClick={() => deleteBooking(b.id)}
                          disabled={actionBusyId === b.id}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {editingId === b.id && (
                      <div className="dash-edit-form">
                        <label>
                          Date
                          <input
                            type="date"
                            value={editForm.date}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, date: e.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Time
                          <input
                            type="time"
                            value={editForm.time}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, time: e.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Status
                          <select
                            value={editForm.status}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, status: e.target.value }))
                            }
                          >
                            <option value="pending">pending</option>
                            <option value="approved">approved</option>
                            <option value="completed">completed</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </label>
                        <label>
                          Notes
                          <textarea
                            value={editForm.notes}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, notes: e.target.value }))
                            }
                          />
                        </label>
                        <div className="dash-edit-actions">
                          <button
                            type="button"
                            onClick={() => saveBookingEdit(b.id)}
                            disabled={actionBusyId === b.id}
                          >
                            {actionBusyId === b.id ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button type="button" onClick={cancelEditBooking}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'photos' && (
          <>
            {bookings.loading && <p className="dash-meta">Loading...</p>}
            {bookings.error && <p className="dash-error">{bookings.error}</p>}
            {!bookings.loading && !bookings.error && (bookings.items as Booking[]).filter((b) => b.carPhotoUrl).length === 0 && (
              <p className="dash-meta">No booking photos yet.</p>
            )}
            {!bookings.loading && !bookings.error && (
              <div className="dash-photos-grid">
                {(bookings.items as Booking[])
                  .filter((b) => b.carPhotoUrl)
                  .map((b) => (
                    <div className="dash-photo-card" key={b.id}>
                      <a href={b.carPhotoUrl} target="_blank" rel="noreferrer">
                        <img src={b.carPhotoUrl} alt={`${b.customerName} car`} className="dash-photo-img" />
                      </a>
                      <div className="dash-photo-info">
                        <strong>{b.customerName}</strong>
                        <span>{b.packageLabel || b.packageType}</span>
                        <span>{b.date} at {b.time}</span>
                        <span className="dash-badge">{b.status}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        {tab === 'users' && (
          <>
            {users.loading && <p className="dash-meta">Loading...</p>}
            {users.error && <p className="dash-error">{users.error}</p>}
            {!users.loading && !users.error && users.items.length === 0 && (
              <p className="dash-meta">No users found.</p>
            )}
            {!users.loading && !users.error && (
              <div className="dash-list">
                {(users.items as UserRecord[]).map((u) => (
                  <div className="dash-row" key={u.id}>
                    <div className="dash-row-info">
                      <strong>{u.name || '(no name)'}</strong>
                      <span>{u.email}</span>
                      <span>User ID: {u.id}</span>
                    </div>
                    <div className="dash-row-right">
                      <span className="dash-badge">{u.role}</span>
                      <span className={`dash-badge${u.verifiedProfile ? '' : ' dash-badge--off'}`}>
                        {u.verifiedProfile ? 'Verified' : 'Not Verified'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'admin' && (
          <div className="dash-admin-grid">
            <article className="dash-admin-card">
              <h3>Bookings</h3>
              <p>Total: {adminStats.totalBookings}</p>
              <p>Pending: {adminStats.pendingBookings}</p>
              <p>Approved: {adminStats.approvedBookings}</p>
            </article>
            <article className="dash-admin-card">
              <h3>Users</h3>
              <p>Total: {adminStats.totalUsers}</p>
              <p>Verified Profiles: {adminStats.verifiedUsers}</p>
            </article>
            <article className="dash-admin-card">
              <h3>Content</h3>
              <p>Prices: {adminStats.totalPrices}</p>
              <p>Gallery: {adminStats.totalGallery}</p>
              <p>Reviews: {adminStats.totalReviews}</p>
              <p>News: {adminStats.totalNews}</p>
            </article>
            <article className="dash-admin-card">
              <h3>Admin Notes</h3>
              <p>Use Prices, Gallery, Reviews, and News tabs to update customer-facing content.</p>
              <button
                type="button"
                className="dash-add-btn"
                onClick={onToggleStandardSiteAccess}
              >
                {standardSiteAccess ? 'Exit Standard Site Access' : 'Standard Site Access'}
              </button>
            </article>
          </div>
        )}

        {tab === 'prices' && (
          <>
            <p className="dash-meta">
              This editor now manages only the three home page packages. Use the sync button to replace any old price rows with those three database items.
            </p>

            {prices.loading && <p className="dash-meta">Loading...</p>}
            {prices.error && (
              <div className="dash-rules-warning">
                <strong>⚠ Firestore rules not deployed yet.</strong>
                <p>Your security rules file exists but has not been published to Firebase. You need to copy your rules into the Firebase Console.</p>
                <ol>
                  <li>Open <a href="https://console.firebase.google.com/project/tddetailed-dtatabase/firestore/rules" target="_blank" rel="noreferrer">Firebase Console → Firestore → Rules</a></li>
                  <li>Replace all text with the contents of your <code>firestore.rules</code> file</li>
                  <li>Click <strong>Publish</strong></li>
                  <li>Then go to <a href="https://console.firebase.google.com/project/tddetailed-dtatabase/storage/tddetailed-dtatabase.firebasestorage.app/rules" target="_blank" rel="noreferrer">Storage → Rules</a> and do the same with <code>storage.rules</code></li>
                </ol>
                <p style={{fontSize:'0.8rem',opacity:0.7}}>Error: {prices.error}</p>
              </div>
            )}
            {!prices.loading && !prices.error && prices.items.length === 0 && (
              <div className="dash-meta">
                <p>No price packages yet.</p>
                <button
                  type="button"
                  className="dash-add-btn"
                  onClick={replacePricesWithHomePackages}
                  disabled={syncPriceBusy}
                >
                  {syncPriceBusy ? 'Adding...' : 'Add Home Page Packages'}
                </button>
              </div>
            )}
            {!prices.loading && !prices.error && (
              <div className="dash-list">
                {(prices.items as PricingItem[]).map((p) => (
                  <div className="dash-row" key={p.id}>
                    <div className="dash-row-info">
                      <div className="dash-price-head">
                        <strong>{p.name || '(unnamed)'}</strong>
                        <button
                          type="button"
                          className="dash-icon-btn"
                          onClick={() => beginEditPrice(p)}
                          aria-label="Edit package"
                          title="Edit package"
                        >
                          ✎
                        </button>
                      </div>
                      <span>{p.price}</span>
                      {p.description && <span className="dash-notes">{p.description}</span>}
                    </div>
                    <div className="dash-row-right">
                      <label className="dash-check-label dash-check-inline">
                        <input
                          type="checkbox"
                          checked={p.isEnabled}
                          disabled={actionBusyId === p.id}
                          onChange={(e) =>
                            togglePriceFlag(p.id, 'isEnabled', e.target.checked)
                          }
                        />
                        Enabled
                      </label>
                      <label className="dash-check-label dash-check-inline">
                        <input
                          type="checkbox"
                          checked={p.isSpecialOffer}
                          disabled={actionBusyId === p.id}
                          onChange={(e) =>
                            togglePriceFlag(p.id, 'isSpecialOffer', e.target.checked)
                          }
                        />
                        Special
                      </label>
                    </div>

                    {editingPriceId === p.id && (
                      <div className="dash-edit-form">
                        <label>
                          Package Name
                          <input
                            value={priceEditForm.name}
                            onChange={(e) =>
                              setPriceEditForm((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          Price
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={priceEditForm.price}
                            onChange={(e) =>
                              setPriceEditForm((prev) => ({
                                ...prev,
                                price: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          Description
                          <textarea
                            value={priceEditForm.description}
                            onChange={(e) =>
                              setPriceEditForm((prev) => ({
                                ...prev,
                                description: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className="dash-edit-actions">
                          <button
                            type="button"
                            onClick={() => savePriceEdit(p.id)}
                            disabled={priceEditBusy}
                          >
                            {priceEditBusy ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button type="button" onClick={cancelEditPrice}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'gallery' && (
          <>
            {showCreateGallery && (
              <div className="dash-create-form">
                <label>
                  Title
                  <input
                    value={galleryCreateForm.title}
                    onChange={(e) => setGalleryCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Exterior finish"
                  />
                </label>
                <label>
                  Image URL
                  <input
                    value={galleryCreateForm.imageUrl}
                    onChange={(e) => setGalleryCreateForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://..."
                  />
                </label>
                <label>
                  Tone
                  <select
                    value={galleryCreateForm.tone}
                    onChange={(e) => setGalleryCreateForm((prev) => ({ ...prev, tone: e.target.value }))}
                  >
                    <option value="warm">warm</option>
                    <option value="cool">cool</option>
                    <option value="gold">gold</option>
                    <option value="graphite">graphite</option>
                  </select>
                </label>
                <label>
                  Sort Order
                  <input
                    type="number"
                    value={galleryCreateForm.sortOrder}
                    onChange={(e) => setGalleryCreateForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                  />
                </label>
                <label className="dash-check-label">
                  <input
                    type="checkbox"
                    checked={galleryCreateForm.isFeatured}
                    onChange={(e) => setGalleryCreateForm((prev) => ({ ...prev, isFeatured: e.target.checked }))}
                  />
                  Featured
                </label>
                <label className="dash-check-label">
                  <input
                    type="checkbox"
                    checked={galleryCreateForm.isEnabled}
                    onChange={(e) => setGalleryCreateForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                  />
                  Enabled
                </label>
                <div className="dash-create-actions">
                  <button type="button" onClick={createGalleryItem} disabled={galleryBusy}>
                    {galleryBusy ? 'Saving...' : 'Save Gallery Item'}
                  </button>
                </div>
              </div>
            )}

            {gallery.loading && <p className="dash-meta">Loading...</p>}
            {gallery.error && <p className="dash-error">{gallery.error}</p>}
            {!gallery.loading && !gallery.error && gallery.items.length === 0 && (
              <p className="dash-meta">No gallery items found.</p>
            )}
            {!gallery.loading && !gallery.error && (
              <div className="dash-list">
                {(gallery.items as GalleryItem[])
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((g) => (
                    <div className="dash-row" key={g.id}>
                      <div className="dash-row-info">
                        <strong>{g.title || '(untitled)'}</strong>
                        <span>Tone: {g.tone}</span>
                        <span>Sort: {g.sortOrder}</span>
                        <span>{g.isFeatured ? 'Featured' : 'Standard'}</span>
                      </div>
                      <div className="dash-row-right">
                        {g.imageUrl ? (
                          <img className="dash-thumb" src={g.imageUrl} alt={g.title} />
                        ) : null}
                        <span className={`dash-badge${g.isEnabled ? '' : ' dash-badge--off'}`}>
                          {g.isEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <div className="dash-row-actions">
                          <button type="button" onClick={() => beginEditGallery(g)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="dash-remove"
                            onClick={() => deleteGalleryItem(g.id)}
                            disabled={actionBusyId === g.id}
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {editingGalleryId === g.id && (
                        <div className="dash-edit-form">
                          <label>
                            Title
                            <input
                              value={galleryEditForm.title}
                              onChange={(e) => setGalleryEditForm((prev) => ({ ...prev, title: e.target.value }))}
                            />
                          </label>
                          <label>
                            Image URL
                            <input
                              value={galleryEditForm.imageUrl}
                              onChange={(e) => setGalleryEditForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                            />
                          </label>
                          <label>
                            Tone
                            <select
                              value={galleryEditForm.tone}
                              onChange={(e) => setGalleryEditForm((prev) => ({ ...prev, tone: e.target.value }))}
                            >
                              <option value="warm">warm</option>
                              <option value="cool">cool</option>
                              <option value="gold">gold</option>
                              <option value="graphite">graphite</option>
                            </select>
                          </label>
                          <label>
                            Sort Order
                            <input
                              type="number"
                              value={galleryEditForm.sortOrder}
                              onChange={(e) => setGalleryEditForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                            />
                          </label>
                          <label className="dash-check-label">
                            <input
                              type="checkbox"
                              checked={galleryEditForm.isFeatured}
                              onChange={(e) => setGalleryEditForm((prev) => ({ ...prev, isFeatured: e.target.checked }))}
                            />
                            Featured
                          </label>
                          <label className="dash-check-label">
                            <input
                              type="checkbox"
                              checked={galleryEditForm.isEnabled}
                              onChange={(e) => setGalleryEditForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                            />
                            Enabled
                          </label>
                          <div className="dash-edit-actions">
                            <button type="button" onClick={() => saveGalleryEdit(g.id)} disabled={galleryBusy}>
                              {galleryBusy ? 'Saving...' : 'Save Changes'}
                            </button>
                            <button type="button" onClick={cancelEditGallery}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        {tab === 'reviews' && (
          <>
            {showCreateReview && (
              <div className="dash-create-form">
                <label>
                  Reviewer Name
                  <input
                    value={reviewCreateForm.name}
                    onChange={(e) => setReviewCreateForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Customer name"
                  />
                </label>
                <label>
                  Review Text
                  <textarea
                    value={reviewCreateForm.text}
                    onChange={(e) => setReviewCreateForm((prev) => ({ ...prev, text: e.target.value }))}
                    placeholder="Great service"
                  />
                </label>
                <label>
                  Rating
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={reviewCreateForm.rating}
                    onChange={(e) => setReviewCreateForm((prev) => ({ ...prev, rating: e.target.value }))}
                  />
                </label>
                <label className="dash-check-label">
                  <input
                    type="checkbox"
                    checked={reviewCreateForm.isEnabled}
                    onChange={(e) => setReviewCreateForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                  />
                  Enabled
                </label>
                <div className="dash-create-actions">
                  <button type="button" onClick={createReviewItem} disabled={reviewBusy}>
                    {reviewBusy ? 'Saving...' : 'Save Review'}
                  </button>
                </div>
              </div>
            )}

            {reviews.loading && <p className="dash-meta">Loading...</p>}
            {reviews.error && <p className="dash-error">{reviews.error}</p>}
            {!reviews.loading && !reviews.error && reviews.items.length === 0 && (
              <p className="dash-meta">No reviews found.</p>
            )}
            {!reviews.loading && !reviews.error && (
              <div className="dash-list">
                {(reviews.items as ReviewItem[]).map((r) => (
                  <div className="dash-row" key={r.id}>
                    <div className="dash-row-info">
                      <strong>{r.name || '(no name)'}</strong>
                      <span>Rating: {r.rating}/5</span>
                      <span className="dash-notes">{r.text}</span>
                    </div>
                    <div className="dash-row-right">
                      <span className={`dash-badge${r.isEnabled ? '' : ' dash-badge--off'}`}>
                        {r.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <div className="dash-row-actions">
                        <button type="button" onClick={() => beginEditReview(r)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="dash-remove"
                          onClick={() => deleteReviewItem(r.id)}
                          disabled={actionBusyId === r.id}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {editingReviewId === r.id && (
                      <div className="dash-edit-form">
                        <label>
                          Reviewer Name
                          <input
                            value={reviewEditForm.name}
                            onChange={(e) => setReviewEditForm((prev) => ({ ...prev, name: e.target.value }))}
                          />
                        </label>
                        <label>
                          Review Text
                          <textarea
                            value={reviewEditForm.text}
                            onChange={(e) => setReviewEditForm((prev) => ({ ...prev, text: e.target.value }))}
                          />
                        </label>
                        <label>
                          Rating
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={reviewEditForm.rating}
                            onChange={(e) => setReviewEditForm((prev) => ({ ...prev, rating: e.target.value }))}
                          />
                        </label>
                        <label className="dash-check-label">
                          <input
                            type="checkbox"
                            checked={reviewEditForm.isEnabled}
                            onChange={(e) => setReviewEditForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                          />
                          Enabled
                        </label>
                        <div className="dash-edit-actions">
                          <button type="button" onClick={() => saveReviewEdit(r.id)} disabled={reviewBusy}>
                            {reviewBusy ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button type="button" onClick={cancelEditReview}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'news' && (
          <>
            {showCreateNews && (
              <div className="dash-create-form">
                <label>
                  Title
                  <input
                    value={newsCreateForm.title}
                    onChange={(e) => setNewsCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="New update"
                  />
                </label>
                <label>
                  Version (optional)
                  <input
                    value={newsCreateForm.version}
                    onChange={(e) => setNewsCreateForm((prev) => ({ ...prev, version: e.target.value }))}
                    placeholder="v1.2.0"
                  />
                </label>
                <label>
                  Body
                  <textarea
                    value={newsCreateForm.body}
                    onChange={(e) => setNewsCreateForm((prev) => ({ ...prev, body: e.target.value }))}
                    placeholder="What was added or changed"
                  />
                </label>
                <label className="dash-check-label">
                  <input
                    type="checkbox"
                    checked={newsCreateForm.isEnabled}
                    onChange={(e) => setNewsCreateForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                  />
                  Enabled
                </label>
                <div className="dash-create-actions">
                  <button type="button" onClick={createNewsItem} disabled={newsBusy}>
                    {newsBusy ? 'Saving...' : 'Save News Item'}
                  </button>
                </div>
              </div>
            )}

            {news.loading && <p className="dash-meta">Loading...</p>}
            {news.error && <p className="dash-error">{news.error}</p>}
            {!news.loading && !news.error && news.items.length === 0 && (
              <p className="dash-meta">No news items found.</p>
            )}
            {!news.loading && !news.error && (
              <div className="dash-list">
                {(news.items as NewsItem[]).map((n) => (
                  <div className="dash-row" key={n.id}>
                    <div className="dash-row-info">
                      <strong>{n.title || '(untitled)'}</strong>
                      {n.version && <span>Version: {n.version}</span>}
                      <span className="dash-notes">{n.body}</span>
                    </div>
                    <div className="dash-row-right">
                      <span className={`dash-badge${n.isEnabled ? '' : ' dash-badge--off'}`}>
                        {n.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <div className="dash-row-actions">
                        <button type="button" onClick={() => beginEditNews(n)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="dash-remove"
                          onClick={() => deleteNewsItem(n.id)}
                          disabled={actionBusyId === n.id}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {editingNewsId === n.id && (
                      <div className="dash-edit-form">
                        <label>
                          Title
                          <input
                            value={newsEditForm.title}
                            onChange={(e) => setNewsEditForm((prev) => ({ ...prev, title: e.target.value }))}
                          />
                        </label>
                        <label>
                          Version (optional)
                          <input
                            value={newsEditForm.version}
                            onChange={(e) => setNewsEditForm((prev) => ({ ...prev, version: e.target.value }))}
                          />
                        </label>
                        <label>
                          Body
                          <textarea
                            value={newsEditForm.body}
                            onChange={(e) => setNewsEditForm((prev) => ({ ...prev, body: e.target.value }))}
                          />
                        </label>
                        <label className="dash-check-label">
                          <input
                            type="checkbox"
                            checked={newsEditForm.isEnabled}
                            onChange={(e) => setNewsEditForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
                          />
                          Enabled
                        </label>
                        <div className="dash-edit-actions">
                          <button type="button" onClick={() => saveNewsEdit(n.id)} disabled={newsBusy}>
                            {newsBusy ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button type="button" onClick={cancelEditNews}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
