import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/Ui';
import { formatDate } from '../utils';

function phoneLink(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? `tel:${digits}` : null;
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await api.getCustomers());
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    api.getCustomers()
      .then((result) => {
        if (active) setCustomers(result);
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

  if (loading) return <LoadingState label="Loading customers" />;
  if (error) return <ErrorState error={error} onRetry={load} title="Could not load customers" />;

  return (
    <>
      <PageHeader
        eyebrow="Audience"
        title="Customers"
        description="Review who can receive order updates and promotional messages."
      />
      {customers.length === 0 ? (
        <EmptyState title="No customers yet" message="Customers will appear after they opt in or place an order." />
      ) : (
        <div className="table-shell">
          <table className="data-table">
            <caption className="sr-only">Customers and recorded messaging consent</caption>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Message consent</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const href = phoneLink(customer.phone);
                return (
                  <tr key={customer.id}>
                    <td className="font-bold text-emerald-950">{customer.name || 'Unknown'}</td>
                    <td>
                      {href ? <a className="font-medium text-emerald-800 underline-offset-2 hover:underline" href={href}>{customer.phone}</a> : (customer.phone || '—')}
                    </td>
                    <td>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${customer.opted_in ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
                        {customer.opted_in ? 'Opted in' : 'Opted out'}
                      </span>
                    </td>
                    <td>{formatDate(customer.created_at)}</td>
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
