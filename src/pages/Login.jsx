import { useState } from 'react';
import { LockKeyhole, LogIn, Sprout } from 'lucide-react';
import { useAuth } from '../authContext';

export default function Login() {
  const { dismissNotice, login, notice, status } = useAuth();
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState(null);
  const submitting = status === 'authenticating';
  const error = localError || notice;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError(null);
    dismissNotice();

    if (password.length < 14) {
      setLocalError('Enter the configured administrator password.');
      return;
    }

    try {
      await login(password);
      setPassword('');
    } catch {
      // AuthContext exposes the normalized backend error through notice.
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="panel w-full max-w-md p-6 md:p-8" aria-labelledby="login-title">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-amber-400 text-emerald-950">
            <Sprout aria-hidden="true" size={26} />
          </div>
          <div>
            <p className="font-bold text-emerald-950">Small Town Veggies</p>
            <p className="text-sm text-stone-600">Protected operations dashboard</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="mb-1 text-sm font-bold uppercase tracking-[0.16em] text-emerald-800">
            Administrator access
          </p>
          <h1 id="login-title" className="text-3xl font-black tracking-tight text-emerald-950">
            Administrator sign in
          </h1>
          <p className="mt-2 text-stone-600">
            Sign in with the private administrator password configured on the protected backend.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="block" htmlFor="administrator-password">
            <span className="mb-1.5 block text-sm font-bold text-stone-700">Administrator password</span>
            <div className="relative">
              <LockKeyhole
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
                size={19}
              />
              <input
                id="administrator-password"
                className="field pl-10"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                required
                autoFocus
              />
            </div>
          </label>

          <button type="submit" className="button-primary mt-5 w-full" disabled={submitting}>
            <LogIn aria-hidden="true" size={19} />
            {submitting ? 'Signing in…' : 'Sign in securely'}
          </button>
        </form>

        <p className="mt-5 text-xs leading-relaxed text-stone-500">
          Customer messaging and live record changes remain disabled until the production safeguards and staging tests pass.
        </p>
      </section>
    </main>
  );
}
