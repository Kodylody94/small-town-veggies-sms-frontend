const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export const orderStatuses = ['all', 'pending', 'confirmed', 'ready', 'picked_up'];

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  const amount = Number(value);
  return Number.isFinite(amount) ? currencyFormatter.format(amount) : '—';
}

export function formatStatus(status) {
  const normalized = String(status ?? '').trim();
  if (!normalized) return 'Unknown';

  return normalized
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatDate(value) {
  if (!value) return '—';

  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return '—';
    }
  } else {
    date = new Date(value);
  }

  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
}

export function filterOrders(orders, status) {
  const list = Array.isArray(orders) ? orders : [];
  return status === 'all' ? list : list.filter((order) => order?.status === status);
}

export function summarizeOrders(orders) {
  return (Array.isArray(orders) ? orders : []).reduce(
    (summary, order) => {
      summary.total += 1;
      if (Object.prototype.hasOwnProperty.call(summary, order?.status)) summary[order.status] += 1;
      return summary;
    },
    { total: 0, pending: 0, confirmed: 0, ready: 0 },
  );
}

function orderTimestamp(order) {
  for (const field of ['created_at', 'submitted_at', 'updated_at']) {
    if (!order?.[field]) continue;
    const timestamp = new Date(order[field]).getTime();
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

export function recentOrders(orders, limit = 5) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
  return [...(Array.isArray(orders) ? orders : [])]
    .sort((left, right) => {
      const leftTimestamp = orderTimestamp(left);
      const rightTimestamp = orderTimestamp(right);

      if (leftTimestamp !== null || rightTimestamp !== null) {
        if (leftTimestamp === null) return 1;
        if (rightTimestamp === null) return -1;
        if (leftTimestamp !== rightTimestamp) return rightTimestamp - leftTimestamp;
      }

      const leftId = Number(left?.id);
      const rightId = Number(right?.id);
      if (Number.isFinite(leftId) && Number.isFinite(rightId)) return rightId - leftId;
      return String(right?.id ?? '').localeCompare(String(left?.id ?? ''));
    })
    .slice(0, safeLimit);
}

export function pruneSelectedOrderIds(selected, orders) {
  const eligibleIds = new Set((Array.isArray(orders) ? orders : []).map((order) => order?.id));
  return new Set([...(selected instanceof Set ? selected : [])].filter((id) => eligibleIds.has(id)));
}

export function statusClasses(status) {
  const classes = {
    pending: 'bg-amber-100 text-amber-900',
    confirmed: 'bg-sky-100 text-sky-900',
    ready: 'bg-emerald-100 text-emerald-900',
    picked_up: 'bg-stone-200 text-stone-800',
  };

  return classes[status] ?? 'bg-stone-100 text-stone-700';
}
