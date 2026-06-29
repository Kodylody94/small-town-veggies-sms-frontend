export const orderStatuses = ['all', 'pending', 'confirmed', 'ready', 'picked_up'];

export function formatMoney(value) {
  const amount = Number(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatStatus(status = '') {
  return status
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function filterOrders(orders, status) {
  return status === 'all' ? orders : orders.filter((order) => order.status === status);
}

export function summarizeOrders(orders) {
  return {
    total: orders.length,
    pending: orders.filter((order) => order.status === 'pending').length,
    confirmed: orders.filter((order) => order.status === 'confirmed').length,
    ready: orders.filter((order) => order.status === 'ready').length,
  };
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
