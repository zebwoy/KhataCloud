import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Select, { SingleValue } from 'react-select';
import type { UserTypeOption } from '../types';

interface LoginPageProps {
  userType: 'admin' | 'trial';
  displayTitle: string;
  isTitleAnimating: boolean;
  onUserTypeChange: (option: SingleValue<UserTypeOption>) => void;
  onLogin: (password: string) => void;
  isAuthenticating: boolean;
  authError: string;
}

const userTypeOptions: UserTypeOption[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'trial', label: 'Trial' },
];

export default function LoginPage({
  userType,
  displayTitle,
  isTitleAnimating,
  onUserTypeChange,
  onLogin,
  isAuthenticating,
  authError,
}: LoginPageProps) {
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = () => {
    if (userType === 'admin' && !loginPassword.trim()) return;
    onLogin(loginPassword);
    if (userType === 'trial') setLoginPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        <div className="hidden md:flex flex-col justify-between bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 text-white p-10">
          <div>
            <p className={`text-sm font-medium text-white/80 transition-all duration-200 ease-in-out ${isTitleAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
              {displayTitle}
            </p>
            <h1 className="text-3xl font-bold mt-2 leading-tight">Accounting & Reporting</h1>
            <p className="mt-4 text-white/80 text-sm leading-relaxed">
              Secure access to your finance workspace. All data stays protected;
              passwords are validated on the server and never stored in the browser.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-white/80">
            <span className="h-2 w-2 rounded-full bg-emerald-300"></span>
            Encrypted connection • Server-side auth
          </div>
        </div>

        <div className="bg-white text-slate-900 p-8 md:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold text-indigo-600 mb-2">Welcome back</p>
            <h2 className="text-2xl font-bold text-slate-900">Sign in to continue</h2>
            <p className="text-sm text-slate-500 mt-1">Use the admin password provided.</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">User</label>
              <Select<UserTypeOption>
                options={userTypeOptions}
                value={userTypeOptions.find((opt) => opt.value === userType)}
                onChange={onUserTypeChange}
                classNamePrefix="hk-select"
                className="text-sm"
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: 12,
                    borderColor: '#cbd5e1',
                    minHeight: '44px',
                    boxShadow: 'none',
                    '&:hover': {
                      borderColor: '#cbd5e1',
                    },
                  }),
                  placeholder: (base) => ({
                    ...base,
                    color: '#64748b',
                  }),
                }}
              />
              {userType === 'trial' && (
                <p className="mt-1 text-xs text-slate-500">Trial mode shows sample data. No password required.</p>
              )}
            </div>
            {userType === 'admin' && (
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            )}

            {authError && (
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={isAuthenticating}
              className={`w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold shadow hover:bg-indigo-700 transition ${isAuthenticating ? 'opacity-80 cursor-not-allowed' : ''
                }`}
            >
              {isAuthenticating ? 'Signing in...' : 'Sign in'}
            </button>

            {userType === 'admin' && (
              <p className="text-xs text-slate-500 text-center">
                Password is verified securely on the server and never stored in the browser.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
