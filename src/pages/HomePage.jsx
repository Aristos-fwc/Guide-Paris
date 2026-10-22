import Footer from '../components/Footer.jsx';
import TransitionLink from '../components/TransitionLink.jsx';
import { loadAboutPage, loadGuidesPage } from './lazy.js';
import { useTitle } from '../useTitle.js';

// The landing page: a full-screen welcome before the map.
export default function HomePage() {
  useTitle();
  return (
    <div style={{ background: '#fff', color: 'var(--color-text)' }}>
      <header className="hero home">
        <div className="hero-body home-body">
          <p className="home-kicker">Welcome to</p>
          <h1 className="hero-title">
            City Guide<br />
            <span>: Paris</span>
          </h1>
          <p className="home-tagline">
            An illustrated map of the places we love in the city: museums, bars, parks, shops and the corners in between.
          </p>
          <div className="home-actions">
            <TransitionLink to="/map" label="The map" className="btn btn-primary home-enter">
              Enter the map
            </TransitionLink>
            <TransitionLink to="/guides" label="Guides" className="btn home-secondary" onMouseEnter={loadGuidesPage} onFocus={loadGuidesPage}>
              Browse the guides
            </TransitionLink>
            <TransitionLink to="/about" label="About us" className="btn home-secondary" onMouseEnter={loadAboutPage} onFocus={loadAboutPage}>
              About us
            </TransitionLink>
          </div>
        </div>
        <Footer overlay />
      </header>
    </div>
  );
}
