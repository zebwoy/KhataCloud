import { X } from 'lucide-react';
import DatePicker from 'react-datepicker';
import Select, { SingleValue } from 'react-select';
import 'react-datepicker/dist/react-datepicker.css';
import type {
  FormState,
  CategoryOption,
  SubcategoryOption,
  TrusteeOption,
  Theme,
} from '../types';
import type { FieldLabels } from '../utils/constants';
import { categoryOptions, remarkLabels } from '../utils/constants';

interface TransactionFormProps {
  formData: FormState;
  setFormData: (data: FormState) => void;
  formErrors: Record<string, string>;
  editingTransactionId: number | null;
  isSyncing: boolean;
  theme: Theme;
  fieldLabels: FieldLabels;
  subcategoryOptions: SubcategoryOption[];
  trusteeOptions: TrusteeOption[];
  filteredSavedCounterparties: string[];
  showCounterpartyDropdown: boolean;
  setShowCounterpartyDropdown: (show: boolean) => void;
  playSoundOnSuccess: boolean;
  setPlaySoundOnSuccess: (play: boolean) => void;
  getPrimaryButtonClasses: (isActive?: boolean) => string;
  onCategorySelect: (option: SingleValue<CategoryOption>) => void;
  onSubcategorySelect: (option: SingleValue<SubcategoryOption>) => void;
  onCustodianSelect: (option: SingleValue<TrusteeOption>) => void;
  onCounterpartySelect: (option: SingleValue<TrusteeOption>) => void;
  onLabelClick: (label: string) => void;
  onDeleteSavedCounterparty: (cp: string, e: React.MouseEvent) => void;
  onCancelEdit: () => void;
  onSubmit: () => void;
}

// ── Shared react-select styles ───────────────────────────────────────────────
// Single source of truth — avoids copy-pasting the same style object 4 times.
function getSelectStyles(isDark: boolean) {
  return {
    control: (base: object) => ({
      ...base,
      borderRadius: 12,
      borderColor: isDark ? '#334155' : '#e2e8f0',
      minHeight: '38px',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      boxShadow: 'none',
    }),
    menu: (base: object) => ({
      ...base,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    }),
    option: (base: object, state: { isSelected: boolean; isFocused: boolean }) => ({
      ...base,
      backgroundColor: state.isSelected
        ? '#7c3aed'   // violet-600
        : state.isFocused
        ? (isDark ? '#1e293b' : '#f5f3ff') // violet-50 on light
        : 'transparent',
      color: state.isSelected ? '#ffffff' : (isDark ? '#f1f5f9' : '#111827'),
    }),
    singleValue: (base: object) => ({ ...base, color: isDark ? '#f1f5f9' : '#111827' }),
    input:       (base: object) => ({ ...base, color: isDark ? '#f1f5f9' : '#111827' }),
    placeholder: (base: object) => ({ ...base, color: isDark ? '#94a3b8' : '#6b7280' }),
  };
}

// ── Shared input className ────────────────────────────────────────────────────
const inputClass = [
  'w-full px-4 py-2 text-sm rounded-xl',
  'border border-gray-200 dark:border-slate-700',
  'bg-gray-50 dark:bg-slate-800',
  'text-gray-900 dark:text-white',
  'focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500',
  'transition-all',
].join(' ');

export default function TransactionForm({
  formData,
  setFormData,
  formErrors,
  editingTransactionId,
  isSyncing,
  theme,
  fieldLabels,
  subcategoryOptions,
  trusteeOptions,
  filteredSavedCounterparties,
  showCounterpartyDropdown,
  setShowCounterpartyDropdown,
  playSoundOnSuccess,
  setPlaySoundOnSuccess,
  getPrimaryButtonClasses,
  onCategorySelect,
  onSubcategorySelect,
  onCustodianSelect,
  onCounterpartySelect,
  onLabelClick,
  onDeleteSavedCounterparty,
  onCancelEdit,
  onSubmit,
}: TransactionFormProps) {
  return (
    <div className="bg-white dark:bg-black dark:border dark:border-gray-900 border border-gray-200 rounded-lg shadow-2xl dark:shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        {editingTransactionId ? 'Edit Transaction' : 'Add New Transaction'}
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700 dark:text-gray-300">Date *</label>
            <DatePicker
              selected={formData.date ? new Date(formData.date) : null}
              onChange={(date: Date | null) => {
                setFormData({
                  ...formData,
                  date: date ? date.toISOString().split('T')[0] : '',
                });
              }}
              dateFormat="yyyy-MM-dd"
              className={inputClass}
              placeholderText="Select date"
            />
            {formErrors.date && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.date}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Category *</label>
            <Select<CategoryOption>
              options={categoryOptions}
              value={categoryOptions.find((opt) => opt.value === formData.category)}
              onChange={onCategorySelect}
              classNamePrefix="hk-select"
              className="text-sm"
              styles={getSelectStyles(theme.mode === 'dark')}
            />
            {formErrors.category && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.category}</p>
            )}
          </div>
        </div>

        <div className={`grid grid-cols-1 ${formData.category !== 'Transfer' ? 'md:grid-cols-2' : ''} gap-4`}>
          {formData.category !== 'Transfer' && (
          <div>
            <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Subcategory *</label>
            <Select<SubcategoryOption>
              options={subcategoryOptions}
              value={subcategoryOptions.find((opt) => opt.value === formData.subcategory)}
              onChange={onSubcategorySelect}
              classNamePrefix="hk-select"
              className="text-sm"
              styles={getSelectStyles(theme.mode === 'dark')}
            />
            {formErrors.subcategory && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.subcategory}</p>
            )}
          </div>
          )}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className={inputClass}
            />
            {formErrors.amount && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.amount}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Custodian Field — Always a trustee dropdown */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              {fieldLabels.custodianLabel} *
            </label>
            <Select<TrusteeOption>
              options={trusteeOptions}
              value={trusteeOptions.find((opt) => opt.value === formData.custodian) ?? null}
              onChange={onCustodianSelect}
              classNamePrefix="hk-select"
              className="text-sm"
              placeholder={fieldLabels.custodianPlaceholder}
              styles={getSelectStyles(theme.mode === 'dark')}
            />
            {formErrors.custodian && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.custodian}</p>
            )}
          </div>

          {/* Counterparty Field — Dropdown for Transfer, text input for Income/Expense */}
          <div className="relative">
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              {fieldLabels.counterpartyLabel} *
            </label>
            {formData.category === 'Transfer' ? (
              <>
                <Select<TrusteeOption>
                  options={trusteeOptions.filter(opt => opt.value !== formData.custodian.trim())}
                  value={trusteeOptions.find((opt) => opt.value === formData.counterparty) ?? null}
                  onChange={onCounterpartySelect}
                  classNamePrefix="hk-select"
                  className="text-sm"
                  placeholder={fieldLabels.counterpartyPlaceholder}
                  styles={getSelectStyles(theme.mode === 'dark')}
                />
              </>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder={fieldLabels.counterpartyPlaceholder}
                  value={formData.counterparty}
                  onChange={(e) => {
                    setFormData({ ...formData, counterparty: e.target.value });
                    setShowCounterpartyDropdown(true);
                  }}
                  onFocus={() => {
                    if (filteredSavedCounterparties.length > 0) {
                      setShowCounterpartyDropdown(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCounterpartyDropdown(false), 200);
                  }}
                  className={inputClass}
                />
                
                {/* Saved Counterparties Dropdown */}
                {showCounterpartyDropdown && filteredSavedCounterparties.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-black border border-gray-200 dark:border-gray-900 rounded-lg shadow-lg dark:shadow-[0_10px_25px_rgba(0,0,0,0.7)] max-h-60 overflow-y-auto">
                    {filteredSavedCounterparties.map((cp) => (
                      <div
                        key={cp}
                        className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                        onMouseDown={(e) => {
                          if ((e.target as HTMLElement).closest('button')) return;
                          e.preventDefault();
                          setFormData({ ...formData, counterparty: cp });
                          setShowCounterpartyDropdown(false);
                        }}
                      >
                        <span 
                          className="text-sm text-gray-900 dark:text-gray-100 flex-1"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setFormData({ ...formData, counterparty: cp });
                            setShowCounterpartyDropdown(false);
                          }}
                        >
                          {cp}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => onDeleteSavedCounterparty(cp, e)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="ml-2 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          title="Delete"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {formErrors.counterparty && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.counterparty}</p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Remarks *</label>
          
          {/* Label Buttons */}
          <div className="mb-3 flex flex-wrap gap-2">
            {remarkLabels.map((label) => {
              // Check if label exists as a whole word (case-insensitive)
              const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const labelRegex = new RegExp(`\\b${escapedLabel}\\b`, 'i');
              const isLabelInRemarks = labelRegex.test(formData.remarks);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onLabelClick(label)}
                  disabled={isLabelInRemarks}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isLabelInRemarks
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed line-through'
                      : 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 hover:scale-105 active:scale-95 shadow-sm'
                  }`}
                  title={isLabelInRemarks ? 'Label already added' : `Add ${label}`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <textarea
            placeholder="Type your remarks or click labels above to add them"
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            rows={3}
            className={inputClass}
          />
          {formErrors.remarks && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.remarks}</p>
          )}
        </div>

        <div className="flex gap-3">
          {editingTransactionId && (
            <button
              onClick={onCancelEdit}
              disabled={isSyncing}
              className={`flex-1 bg-gray-500 dark:bg-gray-800 text-white py-2 rounded-lg font-semibold hover:bg-gray-600 dark:hover:bg-gray-700 ${isSyncing ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              Cancel
            </button>
          )}
          <button
            onClick={onSubmit}
            disabled={isSyncing}
            className={`${editingTransactionId ? 'flex-1' : 'w-full'} ${getPrimaryButtonClasses()} py-2 rounded-lg font-semibold ${isSyncing ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSyncing 
              ? 'Saving...' 
              : editingTransactionId 
                ? 'Update Transaction' 
                : 'Add Transaction'}
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            id="success-sound"
            type="checkbox"
            checked={playSoundOnSuccess}
            onChange={(e) => setPlaySoundOnSuccess(e.target.checked)}
            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-gray-600"
          />
          <label htmlFor="success-sound" className="select-none">
            Play sound on successful entry
          </label>
        </div>
      </div>
    </div>
  );
}