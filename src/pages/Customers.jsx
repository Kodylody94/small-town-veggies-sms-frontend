import { useEffect, useState } from 'react';
import { api } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/Ui';

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
  if (error) return <ErrorState error={error} onRetry={load} />;

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
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Message consent</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="font-bold text-emerald-950">{customer.name || 'Unknown'}</td>
                  <td>{customer.phone}</td>
                  <td>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${customer.opted_in ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'}`}>
                      {customer.opted_in ? 'Opted in' : 'Opted out'}
                    </span>
                  </td>
                  <td>{new Date(customer.created_at).toLocaleDateString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
