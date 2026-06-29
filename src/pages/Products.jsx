import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, isDemoMode } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/Ui';
import { formatMoney } from '../utils';

const emptyForm = { name: '', price: '', unit: '' };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await api.getProducts());
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    api.getProducts()
      .then((result) => {
        if (active) setProducts(result);
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

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.addProduct({ ...form, price: Number(form.price) });
      setForm(emptyForm);
      await load();
    } catch (saveError) {
      setError(saveError);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState label="Loading products" />;

  return (
    <>
      <PageHeader
        eyebrow="Availability"
        title="Products"
        description="Maintain the items, units, and prices customers can order."
      />

      {error && <div className="mb-5"><ErrorState error={error} /></div>}

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <form className="panel h-fit" onSubmit={submit}>
          <h2 className="mb-4 text-xl font-black text-emerald-950">Add a product</h2>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-stone-700">Product name</span>
              <input className="field" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Purple Hull Peas" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-stone-700">Price</span>
              <input className="field" required min="0" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="30.00" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-stone-700">Unit</span>
              <input className="field" required value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} placeholder="bucket" />
            </label>
            <button type="submit" className="button-primary w-full" disabled={isDemoMode || saving} title={isDemoMode ? 'Connect the live backend to add products.' : undefined}>
              <Plus size={18} aria-hidden="true" /> {saving ? 'Adding…' : 'Add product'}
            </button>
          </div>
        </form>

        {products.length === 0 ? (
          <EmptyState title="No products listed" message="Add your first product to begin building the order menu." />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Unit</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="font-bold text-emerald-950">{product.name}</td>
                    <td>{formatMoney(product.price)}</td>
                    <td>{product.unit}</td>
                    <td>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${product.active === false ? 'bg-stone-200 text-stone-700' : 'bg-emerald-100 text-emerald-900'}`}>
                        {product.active === false ? 'Unavailable' : 'Available'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
