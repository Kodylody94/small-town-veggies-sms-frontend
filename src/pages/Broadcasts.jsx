import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { PageHeader } from '../components/Ui';

const MAX_LENGTH = 320;

export default function Broadcasts() {
  const [message, setMessage] = useState('');

  return (
    <>
      <PageHeader
        eyebrow="Customer communication"
        title="Updates"
        description="Draft a concise customer update. Delivery remains disabled until the protected backend endpoint is verified."
      />

      <section className="panel max-w-3xl">
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          This screen does not transmit messages yet. Backend authentication, consent enforcement, rate limits, and audit logging must be verified first.
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-stone-700">Draft message</span>
          <textarea
            className="field min-h-40 resize-y"
            maxLength={MAX_LENGTH}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Fresh-picked tomatoes and okra are available today. Reply to place an order."
          />
        </label>
        <div className="mt-2 flex items-center justify-between gap-4 text-sm text-stone-500">
          <p>Only customers with recorded consent may receive a live update.</p>
          <p>{message.length}/{MAX_LENGTH}</p>
        </div>
        <button type="button" className="button-primary mt-5" disabled>
          <MessageSquareText size={18} aria-hidden="true" /> Delivery not connected
        </button>
      </section>
    </>
  );
}
