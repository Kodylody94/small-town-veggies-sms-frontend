import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Broadcasts from './pages/Broadcasts';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import OrderRequest from './pages/OrderRequest';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Reminders from './pages/Reminders';

export default function App() {
  return (
    <Routes>
      <Route path="order" element={<OrderRequest />} />
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<Products />} />
        <Route path="customers" element={<Customers />} />
        <Route path="broadcasts" element={<Broadcasts />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
