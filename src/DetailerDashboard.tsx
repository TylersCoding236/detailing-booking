import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  updateDoc,
} from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { db } from './firebase';

type DashTab = 'bookings' | 'users' | 'admin' | 'prices';

type Booking = {
  id: string;
  customerName: string;
  phone: string;
  address: string;
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

function toBooking(id: string, data: DocumentData): Booking {
  return {
    id,
    customerName: String(data.customerName ?? ''),
    phone: String(data.phone ?? ''),
    address: String(data.address ?? ''),
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
  const [showCreatePrice, setShowCreatePrice] = useState(false);
  const [createPriceBusy, setCreatePriceBusy] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState('');
  const [priceEditBusy, setPriceEditBusy] = useState(false);
  const [priceCreateForm, setPriceCreateForm] = useState<PriceCreateForm>({
    name: '',
    price: '',
    description: '',
    isEnabled: true,
    isSpecialOffer: false,
  });
  const [priceEditForm, setPriceEditForm] = useState<PriceEditForm>({
    name: '',
    price: '',
    description: '',
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
    };
  }, [bookings.items, users.items, prices.items]);

  const tabData =
    tab === 'bookings' ? bookings : tab === 'users' ? users : tab === 'prices' ? prices : null;

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
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'approved',
        approvedAt: serverTimestamp(),
      });
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

    if (!nextDate || !nextTime || !nextStatus) {
      setActionError('Date, time, and status are required.');
      return;
    }

    setActionBusyId(bookingId);
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        date: nextDate,
        time: nextTime,
        status: nextStatus,
        notes: editForm.notes.trim(),
        updatedAt: serverTimestamp(),
      });
      setActionSuccess('Booking updated.');
      cancelEditBooking();
    } catch (err) {
      setActionError(
        err instanceof FirebaseError
          ? `Edit failed: ${err.code}`
          : 'Edit failed.'
      );
    } finally {
      setActionBusyId('');
    }
  }

  async function deleteBooking(bookingId: string) {
    resetActionMessages();
    setActionBusyId(bookingId);
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
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

  async function createPriceItem() {
    resetActionMessages();

    const name = priceCreateForm.name.trim();
    const priceRaw = priceCreateForm.price.trim();
    const description = priceCreateForm.description.trim();

    if (!name || !priceRaw) {
      setActionError('Price package name and price are required.');
      return;
    }

    const parsedPrice = Number(priceRaw);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setActionError('Price must be a valid positive number.');
      return;
    }

    setCreatePriceBusy(true);
    try {
      await addDoc(collection(db, 'pricing'), {
        detailName: name,
        price: parsedPrice,
        description,
        isEnabled: priceCreateForm.isEnabled,
        isSpecialOffer: priceCreateForm.isSpecialOffer,
        createdAt: serverTimestamp(),
      });

      setPriceCreateForm({
        name: '',
        price: '',
        description: '',
        isEnabled: true,
        isSpecialOffer: false,
      });
      setShowCreatePrice(false);
      setActionSuccess('Price package created.');
    } catch (err) {
      setActionError(
        err instanceof FirebaseError
          ? `Create price failed: ${err.code}`
          : 'Create price failed.'
      );
    } finally {
      setCreatePriceBusy(false);
    }
  }

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

  return (
    <section className="panel fade-in dash-page">
      <div className="dash-header">
        <h2>Detailer Dashboard</h2>
      </div>

      <div className="dash-tabs">
        {(['bookings', 'users', 'admin', 'prices'] as DashTab[]).map((t) => (
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
              {tab === 'bookings' ? 'booking' : tab === 'users' ? 'user' : 'price item'}
              {!tabData.loading && tabData.items.length !== 1 ? 's' : ''}
            </span>
            {tab === 'prices' && (
              <button
                className="dash-add-btn"
                type="button"
                onClick={() => setShowCreatePrice((prev) => !prev)}
              >
                {showCreatePrice ? 'Cancel' : 'Create Price'}
              </button>
            )}
          </div>
        )}

        {tab === 'bookings' && (
          <>
            {bookings.loading && <p className="dash-meta">Loading...</p>}
            {bookings.error && <p className="dash-error">{bookings.error}</p>}
            {!bookings.loading && !bookings.error && bookings.items.length === 0 && (
              <p className="dash-meta">No bookings found.</p>
            )}

            {actionError && <p className="dash-error">{actionError}</p>}
            {actionSuccess && <p className="dash-meta">{actionSuccess}</p>}

            {!bookings.loading && !bookings.error && (
              <div className="dash-list">
                {(bookings.items as Booking[]).map((b) => (
                  <div className="dash-row" key={b.id}>
                    <div className="dash-row-info">
                      <strong>{b.customerName || '(no name)'}</strong>
                      <span>Account: {b.bookedByEmail || '(missing email)'}</span>
                      <span>User ID: {b.bookedByUid || '(missing uid)'}</span>
                      <span>{b.phone || '(missing phone)'}</span>
                      <span>{b.address || '(missing address)'}</span>
                      <span>{b.date} at {b.time}</span>
                      {b.notes && <span className="dash-notes">{b.notes}</span>}
                    </div>
                    <div className="dash-row-right">
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
              <h3>Prices</h3>
              <p>Total price rows: {adminStats.totalPrices}</p>
            </article>
            <article className="dash-admin-card">
              <h3>Admin Notes</h3>
              <p>Use the Bookings tab to approve, edit, or remove booking entries.</p>
              <p>Use the Users tab to verify customer profile readiness.</p>
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
            {actionError && <p className="dash-error">{actionError}</p>}
            {actionSuccess && <p className="dash-meta">{actionSuccess}</p>}

            {showCreatePrice && (
              <div className="dash-create-form">
                <label>
                  Package Name
                  <input
                    value={priceCreateForm.name}
                    onChange={(e) =>
                      setPriceCreateForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Basic Wash"
                  />
                </label>
                <label>
                  Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={priceCreateForm.price}
                    onChange={(e) =>
                      setPriceCreateForm((prev) => ({
                        ...prev,
                        price: e.target.value,
                      }))
                    }
                    placeholder="25"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={priceCreateForm.description}
                    onChange={(e) =>
                      setPriceCreateForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Exterior wash and window clean"
                  />
                </label>
                <label className="dash-check-label">
                  <input
                    type="checkbox"
                    checked={priceCreateForm.isEnabled}
                    onChange={(e) =>
                      setPriceCreateForm((prev) => ({
                        ...prev,
                        isEnabled: e.target.checked,
                      }))
                    }
                  />
                  Enabled
                </label>
                <label className="dash-check-label">
                  <input
                    type="checkbox"
                    checked={priceCreateForm.isSpecialOffer}
                    onChange={(e) =>
                      setPriceCreateForm((prev) => ({
                        ...prev,
                        isSpecialOffer: e.target.checked,
                      }))
                    }
                  />
                  Special Offer
                </label>
                <div className="dash-create-actions">
                  <button
                    type="button"
                    onClick={createPriceItem}
                    disabled={createPriceBusy}
                  >
                    {createPriceBusy ? 'Creating...' : 'Save Price Package'}
                  </button>
                </div>
              </div>
            )}

            {prices.loading && <p className="dash-meta">Loading...</p>}
            {prices.error && <p className="dash-error">{prices.error}</p>}
            {!prices.loading && !prices.error && prices.items.length === 0 && (
              <p className="dash-meta">No price items found.</p>
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
      </div>
    </section>
  );
}
