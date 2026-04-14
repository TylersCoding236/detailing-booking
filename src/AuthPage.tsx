import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth, db } from './firebase';

type Role = 'Detailer' | 'Standard' | 'Owner';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

const ROOT_ADMIN_KEY = 'td_root_admin';
const ROOT_ADMIN_USERNAME = 'root';
const ROOT_ADMIN_PASSWORD = '264139';
const ROOT_ADMIN_EMAIL = 'root@tddetailed.admin';

function formatAuthError(err: unknown): string {
  if (!(err instanceof FirebaseError)) {
    return 'Something went wrong. Please try again.';
  }

  switch (err.code) {
    case 'auth/configuration-not-found':
      return 'Firebase Auth is not configured. Enable Authentication and Email/Password sign-in in Firebase Console.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is disabled in Firebase Authentication settings.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized for Firebase Auth. Add it in Firebase Authentication -> Settings -> Authorized domains.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'That email is already in use.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'permission-denied':
      return 'Firestore rules blocked this action.';
    default:
      return `Error: ${err.code}`;
  }
}

async function readUserRole(uid: string): Promise<Role | 'Unknown'> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return 'Unknown';
  const value = String(snap.data().role ?? 'Unknown') as Role | 'Unknown';
  return value;
}

export default function AuthPage({ mode }: AuthPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | 'Unknown' | 'Loading'>('Loading');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setCurrentRole('Unknown');
        return;
      }
      setCurrentRole('Loading');
      try {
        const loadedRole = await readUserRole(user.uid);
        setCurrentRole(loadedRole);
      } catch {
        setCurrentRole('Unknown');
      }
    });

    return () => unsub();
  }, []);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedEmail || !password) {
      setError('Name, email, and password are required.');
      return;
    }

    setBusy(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);

      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid,
        name: trimmedName,
        email: trimmedEmail,
        role: 'Standard',
        createdAt: serverTimestamp(),
      });

      window.location.hash = '#/';
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const loginId = email.trim().toLowerCase();
    if (!loginId || !password) {
      setError('Email and password are required.');
      return;
    }

    if (loginId === ROOT_ADMIN_USERNAME) {
      if (password !== ROOT_ADMIN_PASSWORD) {
        setError('Invalid root credentials.');
        return;
      }

      setBusy(true);
      try {
        let credential;
        try {
          credential = await signInWithEmailAndPassword(auth, ROOT_ADMIN_EMAIL, ROOT_ADMIN_PASSWORD);
        } catch (err) {
          if (err instanceof FirebaseError && err.code === 'auth/invalid-credential') {
            credential = await createUserWithEmailAndPassword(
              auth,
              ROOT_ADMIN_EMAIL,
              ROOT_ADMIN_PASSWORD
            );
          } else {
            throw err;
          }
        }

        await setDoc(
          doc(db, 'users', credential.user.uid),
          {
            uid: credential.user.uid,
            name: 'Root',
            email: ROOT_ADMIN_EMAIL,
            role: 'Owner',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        localStorage.setItem(ROOT_ADMIN_KEY, '1');
        window.dispatchEvent(new Event('root-admin-changed'));
        window.location.hash = '#/dashboard';
      } catch (err) {
        setError(formatAuthError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, loginId, password);
      const role = await readUserRole(credential.user.uid);
      window.location.hash = (role === 'Detailer' || role === 'Owner') ? '#/dashboard' : '#/';
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setError('');
    setSuccess('');
    try {
      localStorage.removeItem(ROOT_ADMIN_KEY);
      window.dispatchEvent(new Event('root-admin-changed'));
      if (auth.currentUser) {
        await signOut(auth);
      }
      setSuccess('Logged out.');
    } catch (err) {
      setError(formatAuthError(err));
    }
  }

  return (
    <section className="panel fade-in auth-page">
      <div className="auth-simple-shell">
        <div className="auth-head">
          <p className="eyebrow">{mode === 'signup' ? 'New Account' : 'Welcome Back'}</p>
          <h2>{mode === 'signup' ? 'Sign Up' : 'Log In'}</h2>
          <p>
            {mode === 'signup'
              ? 'Create your account to book appointments faster.'
              : 'Log in to manage your bookings and account.'}
          </p>
        </div>

        {currentUser && (
          <div className="auth-status auth-status--simple">
            <strong>{currentUser.email}</strong>
            <span>
              {currentRole === 'Loading' ? 'Checking account…' : `Role: ${currentRole}`}
            </span>
          </div>
        )}

        {mode === 'signup' ? (
          <form className="auth-form" onSubmit={handleSignup}>
            <label>
              Full Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Email or Root Username
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="Email or root"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Your password"
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        )}

        <p className="auth-switch">
          {mode === 'signup' ? (
            <a href="#/login">Already have an account? Log in</a>
          ) : (
            <a href="#/signup">Need an account? Sign up</a>
          )}
        </p>

        {currentUser && (
          <button type="button" className="ghost-btn auth-logout-btn" onClick={handleLogout}>
            Log Out
          </button>
        )}

        {error && <p className="verify-error">{error}</p>}
        {success && <p className="verify-success">{success}</p>}
      </div>
    </section>
  );
}
