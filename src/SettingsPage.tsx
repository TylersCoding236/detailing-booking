import { useMemo, useState } from 'react';
import {
  EmailAuthProvider,
  type User,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';
import { auth, db } from './firebase';

interface SettingsPageProps {
  user: User;
  userName: string;
  onProfileUpdated: (name: string) => void;
}

function mapAuthError(err: unknown): string {
  if (!(err instanceof FirebaseError)) {
    return 'Something went wrong. Please try again.';
  }

  switch (err.code) {
    case 'auth/requires-recent-login':
      return 'For security, please log out and log back in, then try again.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Current password is incorrect.';
    case 'auth/email-already-in-use':
      return 'That email is already in use by another account.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'This action is disabled in Firebase Authentication settings. Enable Email/Password in Authentication -> Sign-in method.';
    default:
      return `Error: ${err.code}`;
  }
}

export default function SettingsPage({ user, userName, onProfileUpdated }: SettingsPageProps) {
  const [name, setName] = useState(userName || '');
  const [newEmail, setNewEmail] = useState(user.email ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState('');
  const [currentPasswordForPassword, setCurrentPasswordForPassword] = useState('');

  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const normalizedEmail = useMemo(() => newEmail.trim().toLowerCase(), [newEmail]);

  async function updateName() {
    setBusyAction('name');
    setError('');
    setSuccess('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name cannot be empty.');
      setBusyAction('');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), { name: trimmedName });
      onProfileUpdated(trimmedName);
      setSuccess('Name updated successfully.');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusyAction('');
    }
  }

  async function changeEmail() {
    setBusyAction('email');
    setError('');
    setSuccess('');

    if (!user.email) {
      setError('Current account email is unavailable.');
      setBusyAction('');
      return;
    }

    if (!normalizedEmail) {
      setError('Please enter a new email.');
      setBusyAction('');
      return;
    }

    if (normalizedEmail === user.email.toLowerCase()) {
      setError('New email must be different from your current email.');
      setBusyAction('');
      return;
    }

    if (!currentPasswordForEmail) {
      setError('Please enter your current password to change email.');
      setBusyAction('');
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPasswordForEmail);
      await reauthenticateWithCredential(user, credential);
      await verifyBeforeUpdateEmail(user, normalizedEmail);
      setCurrentPasswordForEmail('');
      setSuccess('Verification email sent to your new address. Open that email to finish the email change.');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusyAction('');
    }
  }

  async function changePassword() {
    setBusyAction('password');
    setError('');
    setSuccess('');

    if (!user.email) {
      setError('Current account email is unavailable.');
      setBusyAction('');
      return;
    }

    if (!newPassword) {
      setError('Please enter a new password.');
      setBusyAction('');
      return;
    }

    if (!currentPasswordForPassword) {
      setError('Please enter your current password to change password.');
      setBusyAction('');
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPasswordForPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPasswordForPassword('');
      setNewPassword('');
      setSuccess('Password updated successfully.');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusyAction('');
    }
  }

  async function sendResetEmail() {
    setBusyAction('reset');
    setError('');
    setSuccess('');

    if (!user.email) {
      setError('No email found for this account.');
      setBusyAction('');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, user.email);
      setSuccess('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusyAction('');
    }
  }

  return (
    <section className="panel fade-in settings-page">
      <div className="settings-head">
        <h2>Account Settings</h2>
        <p>Manage your profile and sign-in details with Firebase Authentication.</p>
      </div>

      <div className="settings-grid">
        <article className="settings-card">
          <h3>Profile</h3>
          <label>
            Display Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button type="button" onClick={updateName} disabled={busyAction === 'name'}>
            {busyAction === 'name' ? 'Saving...' : 'Save Name'}
          </button>
        </article>

        <article className="settings-card">
          <h3>Change Email</h3>
          <p className="settings-muted">
            Firebase will send a verification link to the new email before the
            change is applied.
          </p>
          <label>
            New Email
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label>
            Current Password
            <input
              type="password"
              value={currentPasswordForEmail}
              onChange={(e) => setCurrentPasswordForEmail(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="button" onClick={changeEmail} disabled={busyAction === 'email'}>
            {busyAction === 'email' ? 'Updating...' : 'Update Email'}
          </button>
        </article>

        <article className="settings-card">
          <h3>Change Password</h3>
          <label>
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            Current Password
            <input
              type="password"
              value={currentPasswordForPassword}
              onChange={(e) => setCurrentPasswordForPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="button" onClick={changePassword} disabled={busyAction === 'password'}>
            {busyAction === 'password' ? 'Updating...' : 'Update Password'}
          </button>
        </article>

        <article className="settings-card">
          <h3>Reset Password Email</h3>
          <p className="settings-muted">
            Send a password reset email to <strong>{user.email}</strong>.
          </p>
          <button type="button" onClick={sendResetEmail} disabled={busyAction === 'reset'}>
            {busyAction === 'reset' ? 'Sending...' : 'Send Reset Email'}
          </button>
        </article>
      </div>

      {error && <p className="settings-error">{error}</p>}
      {success && <p className="settings-success">{success}</p>}
    </section>
  );
}
