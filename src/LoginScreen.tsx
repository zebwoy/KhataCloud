/**
 * LoginScreen.tsx — KhataCloud unified login (mounted at /auth)
 *
 * Split layout:
 *   Left  — Brand panel (violet gradient, logo, features, Demo CTA → /trial)
 *   Right — Clerk <SignIn /> component with matching dark appearance
 *
 * Water ripple effect: jquery.ripples (sirxemic) loaded from local /vendor/
 * scripts to avoid CDN/CSP issues. Runs on the full-screen background div
 * sitting behind the auth card (z-0), so the card is never affected.
 */
import { useEffect, useRef } from 'react';
import { SignIn } from '@clerk/react';
import { BookOpen, BarChart3, Shield, ArrowRight } from 'lucide-react';

const FEATURES = [
  { icon: BookOpen,  label: 'Khata & Ledger',     sub: 'Track every rupee in and out' },
  { icon: BarChart3, label: 'Reports & Insights',  sub: 'Balance sheets, income statements' },
  { icon: Shield,    label: 'Multi-org ready',     sub: 'Separate books per organisation' },
];

/** Dynamically append a <script> tag; resolves when loaded, rejects on error. */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-ripple-vendor="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-ripple-vendor', src);
    s.onload  = () => resolve();
    s.onerror = (e) => reject(e);
    document.body.appendChild(s);
  });
}

export default function LoginScreen() {
  const bgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let destroyed = false;

    (async () => {
      try {
        // Load jQuery then the ripples plugin from our own /vendor/ folder
        // (avoids CDN network failures and Content-Security-Policy blocks)
        await loadScript('/vendor/jquery.min.js');
        await loadScript('/vendor/jquery.ripples.js');

        if (destroyed || !bgRef.current) return;

        const $ = (window as any).jQuery;
        if (!$ || !$.fn.ripples) return;

        $(bgRef.current).ripples({
          imageUrl: '/auth-bg.png',   // explicit URL per the docs
          dropRadius: 20,             // pixels
          perturbance: 0.03,          // refraction strength
          resolution: 512,
          interactive: true,          // mouse hover/move generates ripples
        });
      } catch (err) {
        // WebGL unavailable or script load failed — page works fine without it
        console.warn('[Ripples] init skipped:', err);
      }
    })();

    return () => {
      destroyed = true;
      const $ = (window as any).jQuery;
      if ($ && bgRef.current) {
        try { $(bgRef.current).ripples('destroy'); } catch { /* ignore */ }
      }
    };
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">

      {/* ── Full-screen ripple background (z-0, behind the card) ── */}
      {/*
        IMPORTANT: jquery.ripples reads the element's computed background-image
        to create its WebGL texture. We must set a plain background-image URL
        (no CSS gradients — the plugin doesn't support multi-value backgrounds).
        The violet ambient tint is achieved via the overlay div below.
      */}
      <div
        ref={bgRef}
        className="absolute inset-0 z-0"
        style={{ backgroundImage: "url('/auth-bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}
      />

      {/* Violet tint + subtle dark overlay on top of the ripple canvas */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background: 'radial-gradient(ellipse 85% 65% at 20% 50%, rgba(109,40,217,0.38) 0%, rgba(15,23,42,0.55) 100%)',
        }}
      />

      {/* ── Auth card (z-10, pointer-events captured here, not on the bg) ── */}
      <div className="relative z-10 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl shadow-black/90 backdrop-blur-none flex min-h-[440px]">

        {/* ── LEFT BRAND PANEL (transparent violet tint, no blur) ─────────────── */}
        <div
          className="hidden md:flex md:w-[44%] flex-col justify-between p-7 text-white relative overflow-hidden backdrop-blur-none"
          style={{ background: 'linear-gradient(135deg, rgba(76, 29, 149, 0.82) 0%, rgba(109, 40, 217, 0.82) 45%, rgba(124, 58, 237, 0.82) 100%)' }}
        >
          {/* Decorative circles */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/5" />

          {/* Logo */}
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-lg shadow-black/40 shrink-0">
                <img src="/logo.png" alt="KhataCloud" className="w-full h-full object-cover scale-[1.18]" />
              </div>
              <span className="text-xl font-bold tracking-tight">KhataCloud</span>
            </div>
            <p className="text-xs text-violet-200/80 leading-relaxed">
              Smart accounting &amp; reporting for educational institutions
            </p>
          </div>

          {/* Features */}
          <div className="relative space-y-3.5 my-2">
            {FEATURES.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={14} />
                </div>
                <div>
                  <p className="text-xs font-semibold leading-snug">{label}</p>
                  <p className="text-[11px] text-violet-200/70 mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Demo CTA */}
          <div className="relative">
            <div className="h-px bg-white/15 mb-3" />
            <p className="text-[11px] text-violet-200/60 mb-1.5">Want to explore before signing up?</p>
            <button
              onClick={() => { window.location.href = '/trial'; }}
              className="group flex items-center gap-2 text-xs font-semibold text-white/90 hover:text-white transition-colors"
            >
              <span className="w-6 h-6 rounded-lg bg-white/15 group-hover:bg-white/25 flex items-center justify-center transition-colors">
                <ArrowRight size={12} />
              </span>
              Open Demo Account
            </button>
          </div>
        </div>

        {/* ── RIGHT SIGN-IN PANEL (transparent dark slate, no blur) ──────────── */}
        <div className="flex-1 bg-slate-900/85 backdrop-blur-none flex flex-col items-center justify-center px-6 py-6">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-5 md:hidden">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shadow-black/30 shrink-0">
              <img src="/logo.png" alt="KhataCloud" className="w-full h-full object-cover scale-[1.18]" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">KhataCloud</span>
          </div>

          <SignIn
            routing="hash"
            /**
             * Sign-in redirects → /auth (router resolves role → /app or /admin)
             * Sign-up redirects → /app  (new users skip /auth role-check loop;
             *   the RootApp state machine at /app handles org selection / pending)
             *
             * signUpForceRedirectUrl covers first-time Google OAuth sign-ups
             * which go through the sign-up flow embedded in this SignIn widget.
             */
            forceRedirectUrl="/auth"
            fallbackRedirectUrl="/auth"
            signUpForceRedirectUrl="/app"
            signUpFallbackRedirectUrl="/app"
            appearance={{
              variables: {
                colorPrimary:        '#7c3aed',
                colorBackground:     'transparent',
                colorForeground:     '#f1f5f9',
                colorMutedForeground:'#94a3b8',
                colorInput:          'rgba(30, 41, 59, 0.75)',
                colorInputForeground:'#f1f5f9',
                colorDanger:         '#f87171',
                colorBorder:         'rgba(255, 255, 255, 0.12)',
                borderRadius:        '0.75rem',
                fontFamily:          'Inter, system-ui, sans-serif',
              },
              elements: {
                rootBox:           'w-full max-w-sm',
                cardBox:           'shadow-2xl shadow-black/80 bg-slate-950/45 rounded-3xl border border-white/10 p-2 backdrop-blur-none',
                card:              'bg-transparent shadow-none border-none',
                main:              'bg-transparent',
                footer:            'bg-transparent border-none',
                footerAction:      'bg-transparent border-none',
                footerPages:       'bg-transparent border-none',
                socialButtonsBlockButton: 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-700/80 text-slate-200',
                footerActionLink:  'text-violet-400',
                // Fix: "Email code to …" option text was invisible (dark on dark)
                alternativeMethodsBlockButton: 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-700/80',
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
