import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import VmRequest from './pages/VmRequest';
import Admin from './pages/Admin';
import Writer from './pages/Writer';
import Integrationen, { INTEGRATIONEN_PATH } from './pages/Integrationen';
import Landscape, { LANDSCAPE_PATH } from './pages/Landscape';
import { usePortalAuth } from './lib/portalAuth';

/**
 * /admin ist nachweis-gebunden: Nur mit isAdmin=true (portalAuth) wird der
 * Admin-Arbeitsbereich gerendert; ohne Nachweis wird auf die Startseite
 * umgeleitet. Während der /api/me-Abfrage wird nichts gerendert (kein
 * Flackern von Admin-Einträgen).
 */
function AdminRoute() {
  const { loading, isAdmin } = usePortalAuth();
  if (loading) return null;
  return isAdmin ? <Admin isAdmin /> : <Navigate to="/" replace />;
}

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/vm-request" element={<VmRequest />} />
        <Route path="/writer" element={<Writer />} />
        {/* Entscheiderebene (umstrukturiert): die Landscape-Seite (/landscape)
            ist der Einstieg der Entscheiderebene; der Vergleich lebt nicht im
            Portal, sondern als eigene Seite auf der Marketing-Präsenz. */}
        <Route path={INTEGRATIONEN_PATH} element={<Integrationen />} />
        <Route path={LANDSCAPE_PATH} element={<Landscape />} />
        <Route path="/admin" element={<AdminRoute />} />
      </Routes>
    </div>
  );
}

export default App;
