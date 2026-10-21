import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import MapPage from './pages/MapPage.jsx';
import { AboutPage, GuidePage, GuidesPage, LoginPage } from './pages/lazy.js';
import Footer from './components/Footer.jsx';

export default function App() {
  const onHome = useLocation().pathname === '/'; // the home page carries its own account link
  return (
    <>
      <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/guides" element={<GuidesPage />} />
          <Route path="/guides/:guideId" element={<GuidePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!onHome && <Footer />}
    </>
  );
}
