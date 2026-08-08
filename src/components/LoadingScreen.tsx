/**
 * LoadingScreen.tsx — KhataCloud unified full-screen loader
 *
 * Used everywhere in the app (App.tsx, RootApp.tsx via PageSpinner alias).
 * Single design: dark slate background, violet branded spinner, optional label.
 *
 * Replaces the old purple-gradient loader and the dark PageSpinner — they
 * now both render this component so the user sees one consistent experience.
 */

interface Props {
  label?: string;
}

export default function LoadingScreen({ label }: Props = {}) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-5">
      {/* Branded spinner */}
      <div className="relative">
        <div className="h-14 w-14 rounded-full border-2 border-slate-800 border-t-violet-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-9 w-9 rounded-full bg-violet-500/10 flex items-center justify-center">
            <span className="text-sm font-bold text-violet-400">₹</span>
          </div>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm text-slate-500 tracking-wide">
        {label ?? 'Loading…'}
      </p>
    </div>
  );
}
