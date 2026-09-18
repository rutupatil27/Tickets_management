import { Headset, MessagesSquare, ShieldCheck, Zap } from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: Zap,
    title: 'Automatic assignment',
    body: 'New tickets go straight to the least-loaded available agent - no manual triage.',
  },
  {
    icon: MessagesSquare,
    title: 'Real-time conversation',
    body: 'Customers and agents talk inside the ticket, with every message persisted.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    body: 'Customers, agents and admins each see exactly what they should - enforced server-side.',
  },
];

/** Split layout shared by the login and register screens. */
export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-surface-page p-3 sm:p-4">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-panel border border-ink-200/70 bg-white shadow-card lg:grid-cols-2">
        {/* ------------------------------------------------------- brand */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-hero p-10 lg:flex">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/45 blur-3xl"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-white/35 blur-3xl"
          />

          <div className="relative flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand text-white shadow-raised">
              <Headset className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xl font-extrabold tracking-tight text-ink-900">
                Support<span className="text-brand-600">Desk</span>
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
                helpdesk platform
              </span>
            </span>
          </div>

          <div className="relative">
            <h2 className="max-w-sm text-3xl font-extrabold leading-tight tracking-tight text-ink-900">
              Every support request, tracked and answered.
            </h2>
            <ul className="mt-8 space-y-5">
              {HIGHLIGHTS.map((item) => (
                <li key={item.title} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/80 text-brand-600">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="max-w-sm">
                    <span className="block text-sm font-bold text-ink-900">{item.title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-ink-600">
                      {item.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-ink-500">
            MERN · Express · MongoDB · Socket.IO
          </p>
        </aside>

        {/* -------------------------------------------------------- form */}
        <main className="flex flex-col justify-center px-6 py-10 sm:px-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white shadow-raised">
                <Headset className="h-[18px] w-[18px]" />
              </span>
              <span className="text-lg font-extrabold tracking-tight text-ink-900">
                Support<span className="text-brand-600">Desk</span>
              </span>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>}

            <div className="mt-7">{children}</div>

            {footer && <div className="mt-6">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AuthLayout;
