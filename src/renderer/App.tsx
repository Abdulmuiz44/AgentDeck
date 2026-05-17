import RevenueDashboard from './pages/RevenueDashboard';
import PhoneDashboard from './pages/PhoneDashboard';

export default function App() {
  return window.location.pathname.startsWith('/phone') ? <PhoneDashboard /> : <RevenueDashboard />;
}
