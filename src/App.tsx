import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth, db } from './firebase';
import BookingForm from './BookingForm';
import PricingPage from './PricingPage';
import DebugPage from './DebugPage';
import AuthPage from './AuthPage';
import DetailerDashboard from './DetailerDashboard.tsx';
import HomePage from './HomePage';
import SettingsPage from './SettingsPage';
import VerifyAccountPage from './VerifyAccountPage.tsx';
import './App.css';

type Page =
  | 'home'
  | 'learn-more'
  | 'book-now'
  | 'pricing'
  | 'debug'
  | 'signup'
  | 'login'
  | 'dashboard'
  | 'admin'
  | 'settings'
  | 'verify-account';

const ROOT_ADMIN_KEY = 'td_root_admin';

function normalizeRoutePart(value: string): string {
  return value.trim().toLowerCase().replace(/^\/+/, '').replace(/\/+$/, '');
}

function getPageFromLocation(): Page {
  const hashPart = normalizeRoutePart(window.location.hash.replace('#', ''));
  const pathPart = normalizeRoutePart(window.location.pathname);
  const route = hashPart || pathPart;

  if (route === 'learn-more') return 'learn-more';
  if (route === 'book-now') return 'book-now';
  if (route === 'pricing') return 'pricing';
  if (route === 'debug') return 'debug';
  if (route === 'signup') return 'signup';
  if (route === 'login') return 'login';
  if (route === 'dashboard') return 'dashboard';
  if (route === 'admin') return 'admin';
  if (route === 'settings') return 'settings';
  if (route === 'verify-account') return 'verify-account';

  return 'home';
}

function LearnMorePage() {
  return (
    <section className="panel fade-in learn-page">
      <h2>About TD Detailed</h2>
      <div className="learn-grid">
        <article className="learn-card">
          <h3>Who We Are</h3>
          <p>
            TD Detailed is student-owned and built around one thing: reliable,
            straightforward cleaning for local cars.
          </p>
        </article>
        <article className="learn-card">
          <h3>What We Do</h3>
          <p>
            We focus on exterior washes and interior cleaning. We do not offer
            advanced detailing packages, paint correction, or heavy
            restoration.
          </p>
        </article>
        <article className="learn-card">
          <h3>What You Can Expect</h3>
          <p>
            Every appointment is about honest work, fair pricing, and a cleaner
            car than when it arrived.
          </p>
        </article>
      </div>
      <a className="primary-btn" href="#/book-now">
        Book Now
      </a>
    </section>
  );
}

function BookNowPage({ user }: { user: User | null }) {
  return (
    <section className="panel booking-panel fade-in">
      <div className="booking-header">
        <h2>Book Now</h2>
        <p>
          {user
            ? 'Choose your date and time, and we will confirm your booking shortly.'
            : 'Create an account or log in to book an appointment.'}
        </p>
      </div>
      {user ? (
        <div className="booking-layout">
          <aside className="booking-note">
            <h3>Before You Submit</h3>
            <ul>
              <li>Booking is tied to your signed-in account.</li>
              <li>Verify your account details before first booking.</li>
              <li>Choose one package: Exterior, Interior, or Full Detail.</li>
              <li>Upload a car photo so final pricing can be reviewed.</li>
              <li>Pick any open day through next year.</li>
              <li>Only one car is booked per day because a full detail takes about 3 hours.</li>
              <li>Add notes for vehicle size or requests.</li>
            </ul>
          </aside>
          <div className="booking-form-shell">
            <BookingForm user={user} />
          </div>
        </div>
      ) : (
        <div className="booking-auth-prompt">
          <p>
            Already have an account? Log in to book. New here? Sign up in under
            a minute.
          </p>
          <div className="booking-auth-actions">
            <a className="primary-btn" href="#/login">
              Log In
            </a>
            <a className="ghost-btn" href="#/signup">
              Sign Up
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

type UserBooking = {
  id: string;
  date: string;
  time: string;
  status: string;
  notes: string;
};

function SignedInDashboard({
  userUid,
  userName,
  userEmail,
  profileVerified,
}: {
  userUid: string;
  userName: string;
  userEmail: string | null;
  profileVerified: boolean;
}) {
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'bookings'),
      where('bookedByUid', '==', userUid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            date: String(data.date ?? ''),
            time: String(data.time ?? ''),
            status: String(data.status ?? 'pending'),
            notes: String(data.notes ?? ''),
          };
        });
        setBookings(rows);
        setBookingsLoading(false);
      },
      (err) => {
        if (err instanceof FirebaseError) {
          if (err.code === 'permission-denied') {
            setBookingsError(
              'Could not load your bookings. Firestore rules are blocking reads. Publish the latest firestore.rules and try again.'
            );
          } else {
            setBookingsError(`Could not load your bookings (${err.code}).`);
          }
        } else {
          setBookingsError('Could not load your bookings.');
        }
        setBookingsLoading(false);
      }
    );

    return () => unsub();
  }, [userUid]);

  const verifyLabel = profileVerified ? 'Edit Booking Details' : 'Verify Account';

  return (
    <section className="panel fade-in signed-dashboard">
      <h2>Dashboard</h2>
      <p className="signed-dashboard-sub">Your account home for quick actions.</p>

      <div className="signed-dashboard-grid">
        <article className="signed-dashboard-card">
          <h3>Account</h3>
          <p>
            Signed in as <strong>{userName || userEmail}</strong>
          </p>
          <p>
            Profile: <strong>{profileVerified ? 'Verified' : 'Needs verification'}</strong>
          </p>
        </article>

        <article className="signed-dashboard-card">
          <h3>Quick Links</h3>
          <div className="signed-dashboard-links">
            <a href="#/pricing">View Pricing</a>
            <a href="#/learn-more">Learn More</a>
            <a href="#/book-now">Book Now</a>
            <a href="#/verify-account">{verifyLabel}</a>
            <a href="#/settings">Settings</a>
          </div>
        </article>

        <article className="signed-dashboard-card signed-dashboard-card--bookings">
          <h3>My Bookings</h3>
          {bookingsLoading && <p>Loading bookings...</p>}
          {!bookingsLoading && bookingsError && <p>{bookingsError}</p>}
          {!bookingsLoading && !bookingsError && bookings.length === 0 && (
            <p>No bookings yet.</p>
          )}
          {!bookingsLoading && !bookingsError && bookings.length > 0 && (
            <div className="signed-bookings-list">
              {bookings.map((b) => (
                <div className="signed-booking-row" key={b.id}>
                  <div>
                    <strong>{b.date} at {b.time}</strong>
                    {b.notes && <p>{b.notes}</p>}
                  </div>
                  <span className="dash-badge">{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function RootAdminPage({
  onOpenStandardSite,
  onExitRootMode,
}: {
  onOpenStandardSite: () => void;
  onExitRootMode: () => void;
}) {
  return (
    <section className="panel fade-in root-admin-page">
      <h2>Root Admin</h2>
      <p>Admin tools for site management.</p>

      <div className="root-tools-grid">
        <article className="root-tool-card">
          <h3>Site Preview</h3>
          <p>Open the standard site experience exactly as customers see it.</p>
          <button type="button" className="primary-btn" onClick={onOpenStandardSite}>
            Open Standard Site
          </button>
        </article>

        <article className="root-tool-card">
          <h3>Site Utilities</h3>
          <p>Open utility pages and configuration views.</p>
          <div className="root-tool-links">
            <a href="#/debug">Debug Page</a>
            <a href="#/pricing">Pricing Page</a>
            <a href="#/learn-more">Learn More Page</a>
          </div>
        </article>

        <article className="root-tool-card">
          <h3>Session</h3>
          <p>Exit root mode and return to normal login.</p>
          <button type="button" className="ghost-btn" onClick={onExitRootMode}>
            Exit Root Mode
          </button>
        </article>
      </div>
    </section>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [page, setPage] = useState<Page>(getPageFromLocation());
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userProfileVerified, setUserProfileVerified] = useState(false);
  const [standardSiteAccess, setStandardSiteAccess] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [rootAdmin, setRootAdmin] = useState(
    () => localStorage.getItem(ROOT_ADMIN_KEY) === '1'
  );

  const isStaffUser = rootAdmin || userRole === 'Detailer' || userRole === 'Owner';
  const staffAdminMode = isStaffUser && !standardSiteAccess;
  const hasSession = Boolean(user) || rootAdmin;

  useEffect(() => {
    const syncPage = () => {
      setPage(getPageFromLocation());
      setMenuOpen(false);
    };

    window.addEventListener('hashchange', syncPage);
    window.addEventListener('popstate', syncPage);
    syncPage();

    return () => {
      window.removeEventListener('hashchange', syncPage);
      window.removeEventListener('popstate', syncPage);
    };
  }, []);

  useEffect(() => {
    const syncRootSession = () => {
      setRootAdmin(localStorage.getItem(ROOT_ADMIN_KEY) === '1');
    };

    window.addEventListener('storage', syncRootSession);
    window.addEventListener('root-admin-changed', syncRootSession as EventListener);
    syncRootSession();

    return () => {
      window.removeEventListener('storage', syncRootSession);
      window.removeEventListener('root-admin-changed', syncRootSession as EventListener);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          setUserName(snap.exists() ? String(snap.data().name ?? '') : '');
          setUserRole(snap.exists() ? String(snap.data().role ?? '') : '');
          setUserProfileVerified(snap.exists() ? Boolean(snap.data().verifiedProfile) : false);
          setStandardSiteAccess(false);
        } catch {
          setUserName('');
          setUserRole('');
          setUserProfileVerified(false);
          setStandardSiteAccess(false);
        }
      } else {
        setUserName('');
        setUserRole('');
        setUserProfileVerified(false);
        setStandardSiteAccess(false);
      }

      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (rootAdmin && page === 'home' && !standardSiteAccess) {
      setPage('dashboard');
      window.location.hash = '#/dashboard';
      return;
    }

    if (user && page === 'home' && !standardSiteAccess) {
      setPage('dashboard');
      window.location.hash = '#/dashboard';
      return;
    }

    if (!hasSession && page === 'dashboard') {
      setPage('home');
      window.location.hash = '#/';
      return;
    }

    if (!user && page === 'settings') {
      setPage('login');
      window.location.hash = '#/login';
      return;
    }

    if (!user && page === 'verify-account') {
      setPage('login');
      window.location.hash = '#/login';
      return;
    }

    if (!rootAdmin && page === 'admin') {
      setPage('login');
      window.location.hash = '#/login';
    }
  }, [authReady, hasSession, page, rootAdmin, standardSiteAccess, user]);

  async function handleLogout() {
    if (user) {
      await signOut(auth);
    }
    localStorage.removeItem(ROOT_ADMIN_KEY);
    setRootAdmin(false);
    window.dispatchEvent(new Event('root-admin-changed'));
    setMenuOpen(false);
    window.location.hash = '#/';
  }

  function handleExitStandardSite() {
    setStandardSiteAccess(false);
    setMenuOpen(false);
    setPage('dashboard');
    window.location.hash = '#/dashboard';
  }

  function handleOpenStandardSiteFromRoot() {
    setStandardSiteAccess(true);
    setMenuOpen(false);
    window.location.hash = '#/';
  }

  function handleExitRootMode() {
    localStorage.removeItem(ROOT_ADMIN_KEY);
    setRootAdmin(false);
    window.dispatchEvent(new Event('root-admin-changed'));
    setMenuOpen(false);
    window.location.hash = '#/login';
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#/">
          TD Detailed
        </a>
        <div className="menu-wrap">
          <button
            className="menu-btn"
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-controls="main-menu"
          >
            Menu
          </button>
          {menuOpen && (
            <nav id="main-menu" className="menu-dropdown">
              {rootAdmin ? (
                <a href="#/dashboard" onClick={() => setMenuOpen(false)}>
                  Dashboard
                </a>
              ) : user ? (
                <a href="#/dashboard" onClick={() => setMenuOpen(false)}>
                  Dashboard
                </a>
              ) : (
                <a href="#/" onClick={() => setMenuOpen(false)}>
                  Home
                </a>
              )}
              {!staffAdminMode && (
                <a href="#/book-now" onClick={() => setMenuOpen(false)}>
                  Book Now
                </a>
              )}
              {!staffAdminMode && (
                <a href="#/pricing" onClick={() => setMenuOpen(false)}>
                  Pricing
                </a>
              )}
              {!staffAdminMode && (
                <a href="#/learn-more" onClick={() => setMenuOpen(false)}>
                  Learn More
                </a>
              )}
              {user && !staffAdminMode && (
                <a href="#/verify-account" onClick={() => setMenuOpen(false)}>
                  {userProfileVerified ? 'Edit Booking Details' : 'Verify Account'}
                </a>
              )}
              {user && (
                <a href="#/settings" onClick={() => setMenuOpen(false)}>
                  Settings
                </a>
              )}
              <a href="#/debug" onClick={() => setMenuOpen(false)}>
                Debug
              </a>
              {hasSession ? (
                <button className="menu-logout-btn" type="button" onClick={handleLogout}>
                  Log Out
                </button>
              ) : (
                <>
                  <a href="#/signup" onClick={() => setMenuOpen(false)}>
                    Sign Up
                  </a>
                  <a href="#/login" onClick={() => setMenuOpen(false)}>
                    Log In
                  </a>
                </>
              )}
            </nav>
          )}
        </div>
      </header>

      {page === 'home' ? (
        user ? (
          <main className="page-wrap">
            {standardSiteAccess ? (
              <HomePage user={user} userName={userName} />
            ) : (
              <SignedInDashboard
                userUid={user.uid}
                userName={userName}
                userEmail={user.email}
                profileVerified={userProfileVerified}
              />
            )}
          </main>
        ) : (
          <HomePage user={user} userName={userName} />
        )
      ) : (
        <main className="page-wrap">
          {page === 'learn-more' && <LearnMorePage />}
          {page === 'book-now' && <BookNowPage user={user} />}
          {page === 'pricing' && <PricingPage />}
          {page === 'debug' && <DebugPage />}
          {page === 'signup' && <AuthPage mode="signup" />}
          {page === 'login' && <AuthPage mode="login" />}
          {page === 'settings' &&
            (user ? (
              <SettingsPage
                user={user}
                userName={userName}
                onProfileUpdated={(nextName) => setUserName(nextName)}
              />
            ) : (
              <AuthPage mode="login" />
            ))}
          {page === 'verify-account' &&
            (user ? (
              <VerifyAccountPage
                user={user}
                onVerified={(nextName: string) => {
                  setUserName(nextName);
                  setUserProfileVerified(true);
                }}
              />
            ) : (
              <AuthPage mode="login" />
            ))}
          {page === 'dashboard' &&
            (rootAdmin ? (
              <DetailerDashboard
                standardSiteAccess={standardSiteAccess}
                onToggleStandardSiteAccess={() => {
                  setStandardSiteAccess((prev) => !prev);
                }}
              />
            ) : userRole === 'Detailer' || userRole === 'Owner' ? (
              <DetailerDashboard
                standardSiteAccess={standardSiteAccess}
                onToggleStandardSiteAccess={() => {
                  setStandardSiteAccess((prev) => !prev);
                }}
              />
            ) : user ? (
              <SignedInDashboard
                userUid={user.uid}
                userName={userName}
                userEmail={user.email}
                profileVerified={userProfileVerified}
              />
            ) : null)}
          {page === 'admin' &&
            (rootAdmin ? (
              <RootAdminPage
                onOpenStandardSite={handleOpenStandardSiteFromRoot}
                onExitRootMode={handleExitRootMode}
              />
            ) : (
              <AuthPage mode="login" />
            ))}
        </main>
      )}

      {isStaffUser && standardSiteAccess && (
        <button
          type="button"
          className="standard-exit-fab"
          onClick={handleExitStandardSite}
        >
          Exit Standard Site
        </button>
      )}
    </div>
  );
}
