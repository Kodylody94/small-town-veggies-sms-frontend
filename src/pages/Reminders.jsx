import { useEffect, useMemo, useState } from 'react';
import { BellRing } from 'lucide-react';
import { api } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '../components/Ui';
import { pruneSelectedOrderIds } from '../utils';

const pickupDays = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function eligibleReminderOrders(orders) {
  return orders.filter((order) => ['confirmed', 'ready'].includes(order.status));
}

export default function Reminders() {
  const [orders, setOrders] = useState([]);
  const [day, setDay] = useState('All');
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const replaceOrders = (nextOrders) => {
    setOrders(nextOrders);
    setSelected((current) => pruneSelectedOrderIds(current, nextOrders));
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      replaceOrders(eligibleReminderOrders(await api.getOrders()));
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
        if (active) {
          const nextOrders = eligibleReminderOrders(result);
          setOrders(nextOrders);
          setSelected((current) => pruneSelectedOrderIds(current, nextOrders));
        }
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

  const visible = useMemo(
    () => (day === 'All' ? orders : orders.filter((order) => order.pickup_day === day)),
    [orders, day],
  );

  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <LoadingState label="Loading pickup orders" />;
  if (error && orders.length === 0) {
    return <ErrorState error={error} onRetry={load} title="Could not load pickup orders" />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Pickup communication"
        title="Reminders"
        description="Select confirmed or ready orders. Delivery stays disabled until the protected backend endpoint is verified."
      />

      {error && <div className="mb-5"><ErrorState error={error} onRetry={load} title="Could not refresh pickup orders" /></div>}

      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        Reminder delivery is not connected yet. The selection workflow is available for interface review only.
      </div>

      <div className="mb-5 flex flex-wrap gap-2" aria-label="Filter pickup reminders by day">
        {pickupDays.map((pickupDay) => (
          <button
            key={pickupDay}
            type="button"
            onClick={() => setDay(pickupDay)}
            className={day === pickupDay ? 'button-primary' : 'button-secondary'}
            aria-pressed={day === pickupDay}
          >
            {pickupDay}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No pickup reminders needed" message="There are no confirmed or ready orders for this selection." />
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <label key={order.id} className="panel flex cursor-pointer items-center gap-4 p-4">
              <input className="size-5 accent-emerald-800" type="checkbox" checked={selected.has(order.id)} onChange={() => toggle(order.id)} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-emerald-950">{order.customer_name || 'Unknown'}</p>
                <p className="text-sm text-stone-600">Order #{order.id} · {order.pickup_day || 'Pickup day not set'}</p>
              </div>
              <StatusBadge status={order.status} />
            </label>
          ))}
          <button type="button" className="button-primary mt-3" disabled>
            <BellRing size={18} aria-hidden="true" /> Delivery not connected ({selected.size})
          </button>
        </div>
      )}
    </>
  );
}
