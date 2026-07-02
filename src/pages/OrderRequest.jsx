import { useMemo, useState } from 'react';
import { LoaderCircle, Sprout } from 'lucide-react';
import { api } from '../api';
import { pickupDateRange } from '../dateOnly';

const blankOrder = {
  customer_name: '',
  phone: '',
  bucket_price: '30',
  quantity: '1',
  pickup_date: '',
  notes: '',
};

const inputClass = 'min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100';

export default function OrderRequest() {
  const [order, setOrder] = useState(blankOrder);
  const [state, setState] = useState({ status: 'idle', message: '', result: null });
  const pickupDates = useMemo(() => pickupDateRange(), []);
  const total = Number(order.bucket_price) * Number(order.quantity || 0);

  function change(event) {
    setOrder((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setState({ status: 'submitting', message: '', result: null });
    try {
      const result = await api.submitOrder({
        ...order,
        bucket_price: Number(order.bucket_price),
        quantity: Number(order.quantity),
      });
      setState({ status: 'success', message: '', result });
      setOrder(blankOrder);
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'The test order could not be submitted.', result: null });
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1e8] px-4 py-10 text-stone-900">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 rounded-3xl bg-emerald-950 p-7 text-white">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-amber-400 text-emerald-950"><Sprout aria-hidden="true" /></span>
            <div><p className="font-bold">Small Town Veggies</p><p className="text-sm text-emerald-200">Ovett, Mississippi</p></div>
          </div>
          <h1 className="text-3xl font-black">Sandbox order request</h1>
          <p className="mt-2 text-emerald-100">Test the secure 3Min API order connection.</p>
        </header>

        <p className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Testing only:</strong> this creates a sandbox record. It does not collect payment, reserve produce, or send a text.
        </p>

        {state.status === 'success' && (
          <p className="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950" aria-live="polite">
            Sandbox record <span className="font-mono">{state.result.id}</span> was accepted for ${Number(state.result.total).toFixed(2)}.
          </p>
        )}

        <form className="space-y-5 rounded-3xl bg-white p-6 shadow-sm md:p-8" onSubmit={submit}>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 font-semibold">Name<input className={inputClass} name="customer_name" value={order.customer_name} onChange={change} autoComplete="name" maxLength={120} required /></label>
            <label className="space-y-2 font-semibold">Mobile number<input className={inputClass} name="phone" value={order.phone} onChange={change} autoComplete="tel" inputMode="tel" placeholder="601-555-0123" maxLength={30} required /></label>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <label className="space-y-2 font-semibold">Bucket<select className={inputClass} name="bucket_price" value={order.bucket_price} onChange={change}><option value="25">$25 bucket</option><option value="30">$30 bucket</option><option value="35">$35 bucket</option></select></label>
            <label className="space-y-2 font-semibold">Quantity<input className={inputClass} type="number" name="quantity" value={order.quantity} onChange={change} min="1" max="5" step="1" required /></label>
            <label className="space-y-2 font-semibold">Pickup date<input className={inputClass} type="date" name="pickup_date" value={order.pickup_date} onChange={change} min={pickupDates.minimum} max={pickupDates.maximum} required /></label>
          </div>

          <label className="block space-y-2 font-semibold">Notes <span className="font-normal text-stone-500">(optional)</span><textarea className={`${inputClass} min-h-28 py-3`} name="notes" value={order.notes} onChange={change} maxLength={500} /></label>

          <div className="flex flex-col gap-4 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm text-stone-600">Sandbox total</p><p className="text-2xl font-black text-emerald-950">${total.toFixed(2)}</p></div>
            <button type="submit" disabled={state.status === 'submitting'} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 font-bold text-white hover:bg-emerald-900 disabled:opacity-60">
              {state.status === 'submitting' && <LoaderCircle aria-hidden="true" className="animate-spin" size={20} />}
              {state.status === 'submitting' ? 'Submitting…' : 'Submit sandbox order'}
            </button>
          </div>

          {state.status === 'error' && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">{state.message}</p>}
        </form>
      </div>
    </main>
  );
}
