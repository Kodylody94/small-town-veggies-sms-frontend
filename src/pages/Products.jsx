import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, liveMutationsEnabled } from '../api';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '../components/Ui';
import { formatMoney } from '../utils';
import { validateProductForm } from '../validation';

const emptyForm = { name: '', price: '', unit: '' };
const availabilityPresentation = {
  available: { label: 'Available', classes: 'bg-emerald-100 text-emerald-900' },
  unavailable: { label: 'Unavailable', classes: 'bg-stone-200 text-stone-700' },
  unknown: { label: 'Unknown — unavailable', classes: 'bg-amber-100 text-amber-950' },
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorState, setErrorState] = useState(null);

  const load = async () => {
    setLoading(true);
    setErrorState(null);
    try {
      setProducts(await api.getProducts());
    } catch (error) {
      setErrorState({ error, title: 'Could not load products', retry: true });
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
      .catch((error) => {
        if (active) setErrorState({ error, title: 'Could not load products', retry: true });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const validation = validateProductForm(form);
    setFormErrors(validation.errors);
    if (!validation.isValid || !liveMutationsEnabled) return;

    setSaving(true);
    setErrorState(null);
    try {
      await api.addProduct(validation.value);
      setForm({ ...emptyForm });
      await load();
    } catch (error) {
      setErrorState({ error, title: 'Could not add product', retry: false });
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
        description="Maintain the items, units, and prices customers can order. Missing availability is treated as unavailable."
      />

      {errorState && (
        <div className="mb-5">
          <ErrorState
            error={errorState.error}
            title={errorState.title}
            onRetry={errorState.retry ? load : undefined}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <form className="panel h-fit" onSubmit={submit} noValidate>
          <h2 className="mb-4 text-xl font-black text-emerald-950">Add a product</h2>
          {!liveMutationsEnabled && (
            <p id="product-mutation-lock" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
              Product changes are locked until the live mutation safety gate is enabled.
            </p>
          )}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-stone-700">Product name</span>
              <input
                className="field"
                maxLength={80}
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Purple Hull Peas"
                aria-invalid={Boolean(formErrors.name)}
                aria-describedby={formErrors.name ? 'product-name-error' : undefined}
              />
              {formErrors.name && <p id="product-name-error" className="mt-1 text-sm text-red-700">{formErrors.name}</p>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-stone-700">Price</span>
              <input
                className="field"
                min="0"
                max="10000"
                step="0.01"
                type="number"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => updateField('price', event.target.value)}
                placeholder="30.00"
                aria-invalid={Boolean(formErrors.price)}
                aria-describedby={formErrors.price ? 'product-price-error' : undefined}
              />
              {formErrors.price && <p id="product-price-error" className="mt-1 text-sm text-red-700">{formErrors.price}</p>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-stone-700">Unit</span>
              <input
                className="field"
                maxLength={40}
                value={form.unit}
                onChange={(event) => updateField('unit', event.target.value)}
                placeholder="bucket"
                aria-invalid={Boolean(formErrors.unit)}
                aria-describedby={formErrors.unit ? 'product-unit-error' : undefined}
              />
              {formErrors.unit && <p id="product-unit-error" className="mt-1 text-sm text-red-700">{formErrors.unit}</p>}
            </label>
            <button
              type="submit"
              className="button-primary w-full"
              disabled={!liveMutationsEnabled || saving}
              aria-describedby={!liveMutationsEnabled ? 'product-mutation-lock' : undefined}
            >
              <Plus size={18} aria-hidden="true" /> {saving ? 'Adding…' : 'Add product'}
            </button>
          </div>
        </form>

        {products.length === 0 ? (
          <EmptyState title="No products listed" message="Add your first product to begin building the order menu." />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <caption className="sr-only">Products and current availability</caption>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Unit</th>
                  <th>Availability</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const availability = availabilityPresentation[product.availability_state] ?? availabilityPresentation.unknown;
                  return (
                    <tr key={product.id}>
                      <td className="font-bold text-emerald-950">{product.name || 'Unnamed product'}</td>
                      <td>{formatMoney(product.price)}</td>
                      <td>{product.unit || '—'}</td>
                      <td>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${availability.classes}`}>
                          {availability.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
