import { useEffect, useState } from 'react';
import { ClipboardList, Clock3, PackageOpen, Users } from 'lucide-react';
import { api } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/Ui';
import { formatMoney, recentOrders, summarizeOrders } from '../utils';

export default function Dashboard() {
  const [state, setState] = useState({ loading: true, error: null, orders: [], customers: [], products: [] });

  const load = async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [orders, customers, products] = await Promise.all([
        api.getOrders(),
        api.getCustomers(),
        api.getProducts(),
      ]);
      setState({ loading: false, error: null, orders, customers, products });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
    }
  };

  useEffect(() => {
    let active = true;

    Promise.all([api.getOrders(), api.getCustomers(), api.getProducts()])
      .then(([orders, customers, products]) => {
        if (active) {
          setState({ loading: false, error: null, orders, customers, products });
        }
      })
      .catch((error) => {
        if (active) {
          setState((current) => ({ ...current, loading: false, error }));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (state.loading) return <LoadingState label="Loading dashboard" />;
  if (state.error) return <ErrorState error={state.error} onRetry={load} />;

  const summary = summarizeOrders(state.orders);
  const latestOrders = recentOrders(state.orders);
  const cards = [
    { label: 'Total orders', value: summary.total, icon: ClipboardList },
    { label: 'Pending', value: summary.pending, icon: Clock3 },
    { label: 'Customers', value: state.customers.length, icon: Users },
    { label: 'Active products', value: state.products.filter((product) => product.active !== false).length, icon: PackageOpen },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Today at a glance"
        title="Dashboard"
        description="Track orders, pickup progress, customer reach, and what is currently available."
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Business summary">
        {cards.map(({ label, value, icon: Icon }) => (
          <article key={label} className="panel">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-600">{label}</span>
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-900">
                <Icon aria-hidden="true" size={20} />
              </span>
            </div>
            <p className="text-4xl font-black text-emerald-950">{value}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black text-emerald-950">Recent orders</h2>
          <p className="text-sm text-stone-500">Newest five</p>
        </div>

        {latestOrders.length === 0 ? (
          <EmptyState title="No orders yet" message="New orders will appear here after they are received." />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <caption className="sr-only">Five newest orders</caption>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Pickup</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {latestOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="font-bold text-emerald-950">#{order.id}</td>
                    <td>{order.customer_name || 'Unknown'}</td>
                    <td>{order.pickup_day || '—'}</td>
                    <td>{formatMoney(order.total)}</td>
                    <td><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
