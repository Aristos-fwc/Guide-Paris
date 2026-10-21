import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Account entry point. Hidden when running without Supabase, where editing is
// open anyway.
// `overlay` places it over the image at the bottom of the home page.
export default function Footer({ overlay = false }) {
  const { usingSupabase, user, isAdmin, ready, signOut } = useAuth();
  if (!usingSupabase) return null;
  return (
    <footer className={'site-footer' + (overlay ? ' site-footer--overlay' : '')}>
      {user ? (
        <>
          <span>{ready ? (isAdmin ? 'Admin' : 'Signed in') : 'Checking…'} · {user.email}</span>
          <button className="btn btn-ghost" onClick={signOut}>Log out</button>
        </>
      ) : (
        <Link to="/login">Log in / Sign up</Link>
      )}
    </footer>
  );
}
