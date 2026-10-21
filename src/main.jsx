import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './styles/modernist.css';
import './styles/app.css';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { GuidesProvider } from './guides.jsx';
import { TransitionProvider } from './transition.jsx';

// HashRouter keeps pages at /#/guides, which works on any static host with no
// redirect configuration (a refresh on /guides would 404 with BrowserRouter).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <GuidesProvider>
          <TransitionProvider>
            <App />
          </TransitionProvider>
        </GuidesProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
