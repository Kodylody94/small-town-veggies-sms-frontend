import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class AppErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Dashboard rendering failed.', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-stone-100 p-6">
        <section className="panel max-w-lg text-center" role="alert">
          <AlertTriangle className="mx-auto mb-3 text-red-700" aria-hidden="true" size={36} />
          <h1 className="text-2xl font-black text-emerald-950">The dashboard could not be displayed</h1>
          <p className="mt-2 text-stone-600">
            Reload the page. If the problem continues, keep live actions disabled and review the latest deployment logs.
          </p>
          <button type="button" className="button-primary mt-5" onClick={() => window.location.reload()}>
            Reload dashboard
          </button>
        </section>
      </main>
    );
  }
}
