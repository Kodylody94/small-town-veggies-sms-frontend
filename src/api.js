import { demoCustomers, demoOrders, demoProducts } from "./demoData";

const apiUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const explicitDemoMode = import.meta.env.VITE_ENABLE_DEMO_DATA === "true";

export const isDemoMode = explicitDemoMode || !apiUrl;

const demoPayloads = {
  "/api/orders": demoOrders,
  "/api/customers": demoCustomers,
  "/api/products": demoProducts,
};

async function request(path, options = {}) {
  if (isDemoMode) {
    if (options.method && options.method !== "GET") {
      throw new Error("Changes are disabled while the dashboard is in demo mode.");
    }
    return demoPayloads[path] ?? [];
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}.`);
  }

  if (response.status === 204) return null;
  const payload = await response.json();
  return payload.data ?? payload;
}

export const api = {
  getOrders: () => request("/api/orders"),
  confirmOrder: (id) => request(`/api/orders/${id}/confirm`, { method: "POST" }),
  markReady: (id) => request(`/api/orders/${id}/ready`, { method: "POST" }),
  markPickedUp: (id) => request(`/api/orders/${id}/pickup`, { method: "POST" }),
  getCustomers: () => request("/api/customers"),
  getProducts: () => request("/api/products"),
  addProduct: (product) => request("/api/products", {
    method: "POST",
    body: JSON.stringify(product),
  }),
  createBroadcast: (message) => request("/api/broadcasts", {
    method: "POST",
    body: JSON.stringify({ message }),
  }),
  createReminders: (orderIds) => request("/api/reminders", {
    method: "POST",
    body: JSON.stringify({ order_ids: orderIds }),
  }),
};
