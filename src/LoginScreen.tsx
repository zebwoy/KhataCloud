/**
 * LoginScreen.tsx — KhataCloud unified login (mounted at /auth)
 *
 * Split layout:
 *   Left  — Brand panel (violet gradient, logo, features, Demo CTA → /trial)
 *   Right — Clerk <SignIn /> component with matching dark appearance
 *
 * After sign-in Clerk redirects to /admin (forceRedirectUrl).
 * "Open Demo Account" links to /trial which auto-authenticates as trial user.
 */
import { SignIn } from '@clerk/react';
import { BookOpen, BarChart3, Shield, ArrowRight } from 'lucide-react';

const FEATURES = [
  { icon: BookOpen,  label: 'Khata & Ledger',     sub: 'Track every rupee in and out' },
  { icon: BarChart3, label: 'Reports & Insights',  sub: 'Balance sheets, income statements' },
  { icon: Shield,    label: 'Multi-org ready',     sub: 'Separate books per organisation' },
];

export default function LoginScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(109,40,217,0.18) 0%, transparent 60%)' }}
      />

      <div className="relative w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl shadow-black/50 flex min-h-[560px]">

        {/* ── LEFT BRAND PANEL ─────────────────────────────────────────── */}
        <div
          className="hidden md:flex md:w-[46%] flex-col justify-between p-10 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #6d28d9 45%, #7c3aed 100%)' }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/5" />

          {/* Logo */}
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg shadow-black/40 shrink-0">
                <img src="/logo.png" alt="KhataCloud" className="w-full h-full object-cover scale-[1.18]" />
              </div>
              <span className="text-2xl font-bold tracking-tight">KhataCloud</span>
            </div>
            <p className="text-sm text-violet-200/80 leading-relaxed">
              Smart accounting &amp; reporting for educational institutions
            </p>
          </div>

          {/* Features */}
          <div className="relative space-y-5">
            {FEATURES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={15} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-snug">{label}</p>
                  <p className="text-xs text-violet-200/70 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Demo CTA */}
          <div className="relative">
            <div className="h-px bg-white/15 mb-5" />
            <p className="text-xs text-violet-200/60 mb-3">Want to explore before signing up?</p>
            <button
              onClick={() => { window.location.href = '/trial'; }}
              className="group flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition-colors"
            >
              <span className="w-7 h-7 rounded-lg bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-colors">
                <ArrowRight size={13} />
              </span>
              Open Demo Account
            </button>
          </div>
        </div>

        {/* ── RIGHT SIGN-IN PANEL ───────────────────────────────────────── */}
        <div className="flex-1 bg-slate-900 flex flex-col items-center justify-center px-6 py-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-8 md:hidden">
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-black/30 shrink-0">
              <img src="/logo.png" alt="KhataCloud" className="w-full h-full object-cover scale-[1.18]" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">KhataCloud</span>
          </div>

          <SignIn
            routing="hash"
            /**
             * forceRedirectUrl   — always redirect here after sign-in (highest priority)
             * fallbackRedirectUrl — used when no other redirect is in context
             * afterSignInUrl      — legacy compat, same intent
             *
             * Together these cover every Clerk sign-in path:
             *   email+password, Google OAuth, magic link, SSO
             */
            forceRedirectUrl="/auth"
            fallbackRedirectUrl="/auth"
            appearance={{
              variables: {
                colorPrimary:        '#7c3aed',
                colorBackground:     '#0f172a',
                colorForeground:     '#f1f5f9',
                colorMutedForeground:'#94a3b8',
                colorInput:          '#1e293b',
                colorInputForeground:'#f1f5f9',
                colorDanger:         '#f87171',
                colorBorder:         '#334155',
                borderRadius:        '0.75rem',
                fontFamily:          'Inter, system-ui, sans-serif',
              },
              elements: {
                card:              'shadow-none bg-transparent',
                rootBox:           'w-full max-w-sm',
                socialButtonsBlockButton: 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200',
                footerActionLink:  'text-violet-400',
                // Fix: "Email code to …" option text was invisible (dark on dark)
                alternativeMethodsBlockButton: 'bg-slate-800 border-slate-700 hover:bg-slate-700',
                alternativeMethodsBlockButtonText: 'text-slate-200',
                alternativeMethodsBlockButtonArrow: 'text-slate-400',
                identityPreviewText: 'text-slate-300',
                identityPreviewEditButton: 'text-violet-400',
              },
            }}
          />

          {/* Mobile demo link */}
          <div className="mt-4 text-center md:hidden">
            <button
              onClick={() => { window.location.href = '/trial'; }}
              className="text-sm text-violet-400 hover:text-violet-300 transition-colors font-medium"
            >
              Try the demo instead →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
