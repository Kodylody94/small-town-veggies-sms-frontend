import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Broadcasts from './pages/Broadcasts';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Reminders from './pages/Reminders';

function SessionLoading() {
  return (
    <main className="grid min-h-screen place-items-center px-4" role="status" aria-live="polite">
      <div className="panel text-stone-600">Verifying administrator session…</div>
    </main>
  );
}

function ProtectedLayout() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading' || status === 'signing-out') return <SessionLoading />;
  if (status !== 'authenticated') {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  return <Layout />;
}

function LoginRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <SessionLoading />;
  if (status === 'authenticated') {
    const requested = location.state?.from;
    const destination =
      typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('/login')
        ? requested
        : '/';
    return <Navigate to={destination} replace />;
  }

  return <Login />;
}

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginRoute />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<Products />} />
        <Route path="customers" element={<Customers />} />
        <Route path="broadcasts" element={<Broadcasts />} />
        <Route path="reminders" element={<Reminders />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
