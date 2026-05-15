import Dashboard from './pages/Dashboard';
import PhoneDashboard from './pages/PhoneDashboard';

export default function App() {
  return window.location.pathname.startsWith('/phone') ? <PhoneDashboard /> : <Dashboard />;
}
