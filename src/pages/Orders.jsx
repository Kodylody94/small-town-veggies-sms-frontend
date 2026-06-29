import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api, isDemoMode } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/Ui';
import { filterOrders, formatMoney, formatStatus, orderStatuses } from '../utils';

const nextActions = {
  pending: { label: 'Confirm', action: api.confirmOrder },
  confirmed: { label: 'Mark ready', action: api.markReady },
  ready: { label: 'Picked up', action: api.markPickedUp },
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await api.getOrders());
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    api.getOrders()
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch((loadError) => {
        if (active) setError(loadError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const visibleOrders = useMemo(() => filterOrders(orders, filter), [orders, filter]);

  const advanceOrder = async (order) => {
    const next = nextActions[order.status];
    if (!next) return;
    setBusyId(order.id);
    setError(null);
    try {
      await next.action(order.id);
      await load();
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading orders" />;

  return (
    <>
      <PageHeader
        eyebrow="Fulfillment"
        title="Orders"
        description="Move each order from pending to confirmed, ready, and picked up."
        actions={
          <button type="button" className="button-secondary" onClick={load}>
            <RefreshCw size={18} aria-hidden="true" /> Refresh
          </button>
        }
      />

      {error && <div className="mb-5"><ErrorState error={error} /></div>}

      <div className="mb-5 flex flex-wrap gap-2" aria-label="Filter orders by status">
        {orderStatuses.map((status) => (
          <button
            type="button"
            key={status}
            onClick={() => setFilter(status)}
            className={filter === status ? 'button-primary' : 'button-secondary'}
          >
            {formatStatus(status)}
          </button>
        ))}
      </div>

      {visibleOrders.length === 0 ? (
        <EmptyState title="No matching orders" message="Choose another status or wait for a new order." />
      ) : (
        <div className="table-shell">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Pickup</th>
                <th>Total</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => {
                const next = nextActions[order.status];
                return (
                  <tr key={order.id}>
                    <td className="font-bold text-emerald-950">#{order.id}</td>
                    <td>{order.customer_name}</td>
                    <td>{order.pickup_day}</td>
                    <td>{formatMoney(order.total)}</td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      {next ? (
                        <button
                          type="button"
                          className="button-primary min-h-9 px-3 py-1.5 text-sm"
                          disabled={isDemoMode || busyId === order.id}
                          onClick={() => advanceOrder(order)}
                          title={isDemoMode ? 'Connect the live backend to update orders.' : undefined}
                        >
                          {busyId === order.id ? 'Saving…' : next.label}
                        </button>
                      ) : (
                        <span className="text-sm text-stone-500">Complete</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
