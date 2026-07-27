import { useState } from 'react';
import { LogOut, Moon, Sun, Palette, X } from 'lucide-react';
import type { Theme, ColorPalette } from '../types';
import { getPrimaryBg } from '../theme';
import type { UserType } from '../hooks/useAuth';

interface HeaderProps {
  displayTitle: string;
  userType: UserType;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onLogout: () => void;
}

export default function Header({ displayTitle, userType, theme, onThemeChange, onLogout }: HeaderProps) {
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  return (
    <div className={`${
      theme.mode === 'dark' 
        ? 'bg-black border-b border-gray-900' 
        : getPrimaryBg(theme.palette)
    } text-white shadow-lg`}>
      <div className="max-w-6xl mx-auto px-4 py-4 md:py-6 flex flex-col md:flex-row md:justify-between md:items-center gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold">{displayTitle}</h1>
            {userType === 'trial' && (
              <span className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full animate-pulse">
                TRIAL MODE
              </span>
            )}
          </div>
          <p className={`text-xs md:text-sm ${theme.mode === 'dark' ? 'text-gray-300' : 'opacity-90'}`}>Accounts | Reporting | Reconciliation</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Theme Toggle Button */}
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="w-full md:w-auto justify-center bg-white/20 hover:bg-white/30 dark:bg-gray-900 dark:hover:bg-gray-800 px-4 py-2 rounded-lg flex items-center gap-2 text-sm md:text-base transition-colors"
              title="Theme Settings"
            >
              {theme.mode === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              <Palette size={16} />
            </button>
            
            {/* Theme Menu */}
            {showThemeMenu && (
              <>
                {/* Mobile overlay backdrop */}
                <div 
                  className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" 
                  onClick={() => setShowThemeMenu(false)}
                />
                {/* Theme Menu Dialog - Responsive positioning */}
                <div className="fixed md:absolute bottom-0 md:bottom-auto left-0 md:left-auto right-0 md:right-0 top-auto md:top-full mt-0 md:mt-2 w-full md:w-64 max-w-md md:max-w-none mx-auto md:mx-0 bg-white dark:bg-black dark:border dark:border-gray-900 rounded-t-2xl md:rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-gray-200 z-50 p-4 md:p-4 max-h-[80vh] md:max-h-none overflow-y-auto md:overflow-y-visible">
                  {/* Close button for mobile */}
                  <div className="flex items-center justify-between mb-4 md:hidden">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">Theme Settings</p>
                    <button
                      onClick={() => setShowThemeMenu(false)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors"
                      aria-label="Close theme menu"
                    >
                      <X size={20} className="text-gray-600 dark:text-gray-400" />
                    </button>
                  </div>
                  
                  {/* Mode Toggle */}
                  <div className="mb-4">
                    <p className="text-sm md:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Mode</p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Sun size={18} className={theme.mode === 'light' ? 'text-yellow-500' : 'text-gray-400'} />
                        <span className={`text-sm font-medium ${theme.mode === 'light' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>Light</span>
                      </div>
                      <button
                        onClick={() => onThemeChange({ ...theme, mode: theme.mode === 'light' ? 'dark' : 'light' })}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          theme.mode === 'dark'
                            ? 'bg-gray-900 focus:ring-gray-800'
                            : (theme.palette === 'indigo' ? 'bg-indigo-600 focus:ring-indigo-500' :
                               theme.palette === 'blue' ? 'bg-blue-600 focus:ring-blue-500' :
                               theme.palette === 'purple' ? 'bg-purple-600 focus:ring-purple-500' :
                               theme.palette === 'emerald' ? 'bg-emerald-600 focus:ring-emerald-500' :
                               'bg-rose-600 focus:ring-rose-500')
                        }`}
                        role="switch"
                        aria-checked={theme.mode === 'dark'}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            theme.mode === 'dark' ? 'translate-x-8' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <div className="flex items-center gap-2">
                        <Moon size={18} className={theme.mode === 'dark' ? 'text-blue-400' : 'text-gray-400'} />
                        <span className={`text-sm font-medium ${theme.mode === 'dark' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>Dark</span>
                      </div>
                    </div>
                  </div>
                      
                  {/* Color Palette - Only show in light mode */}
                  {theme.mode === 'light' && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Color Palette</p>
                    <div className="grid grid-cols-5 gap-2">
                          {(['indigo', 'blue', 'purple', 'emerald', 'rose'] as ColorPalette[]).map((palette) => {
                            const isSelected = theme.palette === palette;
                            const baseClasses = isSelected 
                              ? 'ring-2 ring-offset-2 scale-110' 
                              : 'hover:scale-105 active:scale-95';
                            const colorClasses = {
                              indigo: isSelected ? 'bg-indigo-600 ring-indigo-600' : 'bg-indigo-500 hover:bg-indigo-600',
                              blue: isSelected ? 'bg-blue-600 ring-blue-600' : 'bg-blue-500 hover:bg-blue-600',
                              purple: isSelected ? 'bg-purple-600 ring-purple-600' : 'bg-purple-500 hover:bg-purple-600',
                              emerald: isSelected ? 'bg-emerald-600 ring-emerald-600' : 'bg-emerald-500 hover:bg-emerald-600',
                              rose: isSelected ? 'bg-rose-600 ring-rose-600' : 'bg-rose-500 hover:bg-rose-600',
                            };
                            return (
                              <button
                                key={palette}
                                onClick={() => onThemeChange({ ...theme, palette })}
                                className={`w-full h-10 md:h-10 rounded-lg transition-all touch-manipulation ${baseClasses} ${colorClasses[palette]}`}
                                title={palette.charAt(0).toUpperCase() + palette.slice(1)}
                                aria-label={`Select ${palette} color palette`}
                              />
                            );
                          })}
                        </div>
                      </div>
                  )}
                </div>
              </>
            )}
          </div>
          
          <button
            onClick={onLogout}
            className="w-full md:w-auto justify-center bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm md:text-base"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}
