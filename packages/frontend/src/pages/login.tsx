import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { extractApiError } from '@/lib/error-messages';
import { VI } from '@/lib/vi-text';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Database,
  Phone,
  LayoutDashboard,
  BarChart3,
  Settings,
  LifeBuoy,
  Puzzle,
  Network,
  Bell,
  KeyRound,
} from 'lucide-react';

const VERSION = `v${import.meta.env.VITE_APP_VERSION ?? '1.0.4'}`;

const SIDE_NAV = [
  { icon: Phone, label: 'Tổng đài' },
  { icon: LayoutDashboard, label: 'Quản lý' },
  { icon: BarChart3, label: 'Báo cáo' },
  { icon: Settings, label: 'Hệ thống' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      const { message } = extractApiError(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background text-foreground">
      {/* Decorative sidebar (login-only — no nav) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[280px] flex-col border-r border-dashed border-sidebar-border bg-sidebar py-6 px-4 z-40">
        <div className="flex items-center gap-3 mb-8 px-2">
          <img
            src="/raito.png"
            alt="Raito"
            className="h-10 w-10 rounded-lg object-contain shrink-0"
          />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">Core CRM</h1>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {VERSION.toUpperCase()}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1" aria-label="Decorative navigation">
          {SIDE_NAV.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 cursor-default select-none"
            >
              <Icon className="h-4 w-4" />
              {label}
            </span>
          ))}
        </nav>

        <div className="mt-auto border-t border-dashed border-sidebar-border pt-4">
          <span className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/70 cursor-default select-none">
            <LifeBuoy className="h-4 w-4" />
            Trợ giúp
          </span>
        </div>
      </aside>

      {/* Main canvas with abstract gradient */}
      <div
        className="md:ml-[280px] flex-1 flex flex-col relative"
        style={{
          background:
            'radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--primary) 8%, transparent) 0%, transparent 50%), radial-gradient(circle at 100% 100%, color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 50%)',
        }}
      >
        {/* Decorative top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between px-6 border-b border-dashed border-border bg-card/80 backdrop-blur-md shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Trang chủ</span>
            <span className="text-border">/</span>
            <span className="font-semibold text-primary border-b-2 border-primary pb-0.5">
              Đăng nhập
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-accent bg-accent/40 px-3 py-1 text-xs font-semibold text-accent-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Active Cluster
            </div>
            <button
              type="button"
              tabIndex={-1}
              className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              aria-label="Extensions"
            >
              <Puzzle className="h-5 w-5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              aria-label="Cluster"
            >
              <Network className="h-5 w-5" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="relative p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
            </button>
          </div>
        </header>

        {/* Login card */}
        <main className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative w-full max-w-[440px] overflow-hidden rounded-xl border border-dashed border-border bg-card p-8 shadow-xl"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />

            <div className="flex flex-col items-center mb-8">
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.45 }}
                className="flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-dashed border-border shadow-sm mb-4 overflow-hidden"
              >
                <img
                  src="/raito.png"
                  alt="Raito"
                  className="h-full w-full object-contain p-1.5"
                />
              </motion.div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-1">
                {VI.login}
              </h2>
              <p className="text-xs text-muted-foreground">
                Truy cập vào bảng điều khiển CRM Console
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div className="space-y-1">
                <Label
                  htmlFor="email"
                  className="block font-mono text-[12px] uppercase tracking-wider text-muted-foreground"
                >
                  {VI.email}
                </Label>
                <Input
                  id="email"
                  type="email"
                  name="email-no-fill"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="off"
                  className="h-[42px] bg-background"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="block font-mono text-[12px] uppercase tracking-wider text-muted-foreground"
                  >
                    {VI.password}
                  </Label>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  name="password-no-fill"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="h-[42px] bg-background"
                />
              </div>

              {error && (
                <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 mt-4 font-semibold shadow-lg shadow-primary/20"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? VI.loggingIn : VI.loginButton}
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-dashed border-border flex justify-center gap-4">
              <button
                type="button"
                tabIndex={-1}
                className="p-2 border border-border rounded-lg hover:bg-muted transition-colors"
                aria-label="Đăng nhập với Google"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.5 12.3c0-.85-.08-1.67-.22-2.46H12v4.66h5.9c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.09-1.93 3.29-4.77 3.29-8.26z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.28-1.93-6.14-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.86 14.12A6.99 6.99 0 0 1 5.5 12c0-.74.13-1.45.36-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.68-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.68 2.84C6.72 7.31 9.14 5.38 12 5.38z"
                  />
                </svg>
              </button>
              <button
                type="button"
                tabIndex={-1}
                className="p-2 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                aria-label="Đăng nhập bằng SSO"
              >
                <KeyRound className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        </main>

        {/* Footer status pill */}
        <footer className="p-6 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted shadow-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[13px] text-muted-foreground">System Online</span>
            <span className="h-3 w-px bg-border" />
            <span className="font-mono text-[13px] text-muted-foreground">{VERSION}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
