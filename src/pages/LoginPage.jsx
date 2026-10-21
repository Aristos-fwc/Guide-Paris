import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useTitle } from '../useTitle.js';

// Log in, or create an account. Any account can create its own guides and
// places; only the admin can change other people's.
export default function LoginPage() {
  const { usingSupabase, user, signIn, signUp, signOut } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);
  const signingUp = mode === 'signup';
  useTitle(signingUp ? 'Sign up' : 'Log in');

  // Once signed in, go back to the site.
  useEffect(() => {
    if (user) navigate('/map', { replace: true });
  }, [user, navigate]);

  function switchMode() {
    setMode(signingUp ? 'login' : 'signup');
    setError(null);
    setNote(null);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      if (signingUp) {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) setNote('Account created. Check your email and click the link to confirm it, then log in.');
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err) {
      const m = err.message || '';
      setError(
        /invalid login/i.test(m) ? 'Wrong email or password.'
          : /already registered|already been registered/i.test(m) ? 'This email already has an account. Log in instead.'
          : /signups? not allowed|signup.*disabled/i.test(m) ? 'Sign-ups are closed on this site.'
          : m || (signingUp ? 'Could not create the account.' : 'Could not log in.'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-card">
        <h1 className="login-title">{signingUp ? 'Create an account' : 'Log in'}</h1>
        {!usingSupabase ? (
          <p>No login is needed here: the site is not connected to Supabase, so editing is open in this browser.</p>
        ) : user ? (
          <>
            <p>You are signed in as {user.email}.</p>
            <button className="btn btn-secondary" onClick={signOut}>Log out</button>
          </>
        ) : (
          <form onSubmit={submit} className="login-form">
            {signingUp && <p>With an account you can create your own guides and add places to the map.</p>}
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input id="login-email" className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="login-password">Password{signingUp && <span className="text-muted"> (6 characters or more)</span>}</label>
              <input id="login-password" className="input" type="password" required minLength={signingUp ? 6 : undefined} autoComplete={signingUp ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p role="alert" className="login-error">{error}</p>}
            {note && <p role="status" className="login-note">{note}</p>}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? (signingUp ? 'Creating…' : 'Logging in…') : signingUp ? 'Create my account' : 'Log in'}
            </button>
            <p className="login-switch">
              {signingUp ? 'Already have an account? ' : 'No account yet? '}
              <button type="button" className="btn btn-ghost" style={{ paddingInline: 0 }} onClick={switchMode}>{signingUp ? 'Log in' : 'Sign up'}</button>
            </p>
          </form>
        )}
        <p className="login-back"><Link to="/map">← Back to the guide</Link></p>
      </div>
    </main>
  );
}
