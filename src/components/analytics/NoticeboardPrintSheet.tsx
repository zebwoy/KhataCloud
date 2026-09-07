/**
 * NoticeboardPrintSheet.tsx — 4-page multilingual print template
 *
 * Renders:
 *   Page 1: English original
 *   Page 2: Urdu translation
 *   Page 3: Hindi translation
 *   Page 4: Marathi translation
 *
 * Each page includes the Millat Qur'an Learning Centre QR code for donations.
 */

export interface NoticeboardLineItem {
  id: string | number;
  label: string;
  amount: number;
  subcategory?: string;
  isDeficitCarryOver?: boolean;
}

export interface NoticeboardPrintProps {
  periodLabel: string;
  displayMode: 'detailed' | 'common';
  incomeItems: NoticeboardLineItem[];
  expenseItems: NoticeboardLineItem[];
  totalIncome: number;
  totalExpense: number;
  balance: number;
  isDeficit: boolean;
  qrCodeUrl?: string;
  orgName?: string;
}

// ── Translation dictionary ──────────────────────────────────────────────────
const TRANSLATIONS = {
  ur: {
    fontFamily: "'Noto Nastaliq Urdu', 'Urdu Typesetting', Tahoma, Arial, sans-serif",
    dir: 'rtl' as const,
    orgTitle: 'ملت قرآن لرننگ سینٹر',
    docTitle: 'ماہانہ مالیاتی نوٹس بورڈ',
    periodPrefix: 'برائے ماہ:',
    income: 'آمدنی / وصولی',
    expense: 'اخراجات / ادائیگیاں',
    totalIncome: 'کل آمدنی',
    totalExpense: 'کل اخراجات',
    surplus: 'فاضل / بچت',
    deficit: 'خسارہ / کمی',
    balance: 'میزان / خالص رقم',
    scanToDonate: 'تعاون و عطیات کے لیے کیو آر کوڈ اسکین کریں',
    scanSubtext: 'ملت قرآن لرننگ سینٹر کے مالیاتی استحکام کے لیے آپ کا تعاون بیش قیمت ہے۔',
    auditedNote: 'یہ گوشوارہ منتخب مدت کے تصدیق شدہ مالیاتی حسابات پر مشتمل ہے۔',
    trusteeSig: 'دستخط معتمد / ٹرسٹی',
    treasurerSig: 'دستخط صدر / خزانچی',
    items: {
      salaries: 'تنخواہیں و مشاہرہ عملہ',
      rentWater: 'کرایہ مع پانی کا بل',
      electricLight: 'بجلی کا بل',
      carryForwardDeficit: 'پچھلے مہینے کا بقایا خسارہ',
      donations: 'عطیات، صدقات و زکوٰۃ',
      studentFees: 'طلباء کی تعلیمی فیس',
      grants: 'سرکاری و نجی امداد / گرانٹ',
      otherIncome: 'دیگر متفرق آمدنی',
      utilities: 'یوٹیلیٹیز و عمومی سہولیات',
      booksMaterials: 'کتب و درسی سامان',
      infrastructure: 'تعمیرات، تجدید و مرمت',
      otherExpenses: 'دیگر متفرق اخراجات',
      reimbursement: 'واپسی رقم / ری ایمبرسمنٹ',
      general: 'عمومی',
    } as Record<string, string>,
  },
  hi: {
    fontFamily: "'Noto Sans Devanagari', 'Mangal', Arial, sans-serif",
    dir: 'ltr' as const,
    orgTitle: 'मिल्लत क़ुरआन लर्निंग सेन्टर',
    docTitle: 'मासिक वित्तीय नोटिस बोर्ड',
    periodPrefix: 'अवधि:',
    income: 'आय / प्राप्तियाँ',
    expense: 'व्यय / खर्चे',
    totalIncome: 'कुल आय',
    totalExpense: 'कुल व्यय',
    surplus: 'अधिशेष / बचत',
    deficit: 'घाटा / कमी',
    balance: 'शुद्ध शेष राशि',
    scanToDonate: 'सहयोग एवं दान हेतु क्यूआर कोड स्कैन करें',
    scanSubtext: 'मिल्लत क़ुरआन लर्निंग सेन्टर के संचालन हेतु आपका आर्थिक सहयोग अमूल्य है।',
    auditedNote: 'यह विवरण चयनित अवधि के सत्यापित वित्तीय खातों पर आधारित है।',
    trusteeSig: 'हस्ताक्षर: सचिव / ट्रस्टी',
    treasurerSig: 'हस्ताक्षर: अध्यक्ष / कोषाध्यक्ष',
    items: {
      salaries: 'वेतन एवं मानदेय (शिक्षक/स्टाफ)',
      rentWater: 'किराया एवं पानी का बिल',
      electricLight: 'बिजली का बिल',
      carryForwardDeficit: 'पिछले माह का बकाया घाटा',
      donations: 'दान, चंदा एवं सहयोग',
      studentFees: 'छात्र शिक्षण शुल्क / फीस',
      grants: 'अनुदान एवं सहायता',
      otherIncome: 'अन्य विविध आय',
      utilities: 'जनोपयोगी सेवाएं एवं बिल',
      booksMaterials: 'पुस्तकें एवं पाठ्य सामग्री',
      infrastructure: 'भवन निर्माण एवं मरम्मत',
      otherExpenses: 'अन्य विविध खर्चे',
      reimbursement: 'प्रतिपूर्ति / भुगतान वापसी',
      general: 'सामान्य',
    } as Record<string, string>,
  },
  mr: {
    fontFamily: "'Noto Sans Devanagari', 'Mangal', Arial, sans-serif",
    dir: 'ltr' as const,
    orgTitle: 'मिल्लत कुरआन लर्निंग सेंटर',
    docTitle: 'मासिक आर्थिक नोटीस बोर्ड',
    periodPrefix: 'कालावधी:',
    income: 'जमा / उत्पन्न',
    expense: 'खर्च / देणी',
    totalIncome: 'एकूण जमा',
    totalExpense: 'एकूण खर्च',
    surplus: 'शिल्लक / नफा',
    deficit: 'तूट',
    balance: 'निव्वळ शिल्लक',
    scanToDonate: 'मदत आणि देणगीसाठी QR कोड स्कॅन करा',
    scanSubtext: 'मिल्लत कुरआन लर्निंग सेंटरच्या उपक्रमांसाठी आपले योगदान अत्यंत मोलाचे आहे.',
    auditedNote: 'हे विवरण दर्शविलेल्या कालावधीतील पडताळणी केलेल्या आर्थिक नोंदींवर आधारित आहे.',
    trusteeSig: 'स्वाक्षरी: सचिव / विश्वस्त',
    treasurerSig: 'स्वाक्षरी: अध्यक्ष / खजिनदार',
    items: {
      salaries: 'पगार व मानधन (शिक्षक/कर्मचारी)',
      rentWater: 'भाडे आणि पाणी बिल',
      electricLight: 'वीज बिल',
      carryForwardDeficit: 'मागील महिन्याची उर्वरित तूट',
      donations: 'देणगी व वर्गणी',
      studentFees: 'विद्यार्थी शिक्षण फी',
      grants: 'शासकीय व इतर अनुदान',
      otherIncome: 'इतर विविध जमा',
      utilities: 'उपयोगिता व सेवा बिले',
      booksMaterials: 'पुस्तके आणि शैक्षणिक साहित्य',
      infrastructure: 'इमारत दुरुस्ती व बांधकाम',
      otherExpenses: 'इतर किरकोळ खर्च',
      reimbursement: 'परतावा रक्कम',
      general: 'सर्वसाधारण',
    } as Record<string, string>,
  },
};

function getLineTranslation(label: string, lang: 'ur' | 'hi' | 'mr'): string {
  const t = TRANSLATIONS[lang].items;
  const l = label.toLowerCase();

  if (l.includes('deficit') || l.includes('carry forward') || l.includes('خسارہ') || l.includes('घाटा') || l.includes('तूट')) {
    return t.carryForwardDeficit;
  }
  if (l.includes('salary') || l.includes('salaries') || l.includes('stipend') || l.includes('staff') || l.includes('teacher')) {
    return t.salaries;
  }
  if (l.includes('rent') || l.includes('water')) {
    return t.rentWater;
  }
  if (l.includes('electric') || l.includes('light')) {
    return t.electricLight;
  }
  if (l.includes('donation') || l.includes('chanda') || l.includes('zakat') || l.includes('sadaqah')) {
    return t.donations;
  }
  if (l.includes('student') || l.includes('fee')) {
    return t.studentFees;
  }
  if (l.includes('grant') || l.includes('aid')) {
    return t.grants;
  }
  if (l.includes('book') || l.includes('material')) {
    return t.booksMaterials;
  }
  if (l.includes('infrastruct') || l.includes('repair') || l.includes('construct') || l.includes('maintenance')) {
    return t.infrastructure;
  }
  if (l.includes('utility') || l.includes('utilities')) {
    return t.utilities;
  }
  if (l.includes('other income')) {
    return t.otherIncome;
  }
  if (l.includes('other expense') || l.includes('others')) {
    return t.otherExpenses;
  }
  if (l.includes('reimburse')) {
    return t.reimbursement;
  }

  return label;
}

export default function NoticeboardPrintSheet({
  periodLabel,
  displayMode,
  incomeItems,
  expenseItems,
  totalIncome,
  totalExpense,
  balance,
  isDeficit,
  qrCodeUrl = '/donation-qr.png',
  orgName = "Millat Qur'an Learning Centre",
}: NoticeboardPrintProps) {
  const absBalance = Math.abs(balance);

  return (
    <div className="noticeboard-print-container">

      {/* ═════════════════════════════════════════════════════════════════════
          PAGE 1: ENGLISH (Original Screen Layout)
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="noticeboard-print-page font-sans">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
              Monthly Financial Statement
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">
              {orgName}
            </h1>
            <p className="text-sm font-bold text-violet-700 mt-1">
              Period: {periodLabel} {displayMode === 'common' ? '(Common Summary)' : '(Detailed)'}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-4 py-1.5 rounded-lg font-black text-sm uppercase tracking-wider ${
              isDeficit ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}>
              {isDeficit ? 'DEFICIT' : 'SURPLUS'}: ₹{absBalance.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Two-Column Financial Tables */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Expenses */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex justify-between items-baseline border-b-2 border-red-500 pb-2 mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-red-700">Expenses / Outflows</h2>
              <span className="text-xs font-bold text-slate-500">Amount (₹)</span>
            </div>
            <div className="space-y-2 min-h-[190px]">
              {expenseItems.length > 0 ? (
                expenseItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-baseline text-xs py-1 border-b border-slate-200/60">
                    <span className="font-medium text-slate-800 pr-2">{item.label}</span>
                    <span className="font-bold text-slate-950 tabular-nums whitespace-nowrap">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No expenses recorded</p>
              )}
            </div>
            <div className="mt-4 pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-xs font-black uppercase text-slate-900">Total Expenses</span>
              <span className="text-base font-black text-red-700 tabular-nums">
                ₹{totalExpense.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Income */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex justify-between items-baseline border-b-2 border-emerald-500 pb-2 mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-emerald-700">Income / Receipts</h2>
              <span className="text-xs font-bold text-slate-500">Amount (₹)</span>
            </div>
            <div className="space-y-2 min-h-[190px]">
              {incomeItems.length > 0 ? (
                incomeItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-baseline text-xs py-1 border-b border-slate-200/60">
                    <span className="font-medium text-slate-800 pr-2">{item.label}</span>
                    <span className="font-bold text-slate-950 tabular-nums whitespace-nowrap">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No income recorded</p>
              )}
            </div>
            <div className="mt-4 pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-xs font-black uppercase text-slate-900">Total Income</span>
              <span className="text-base font-black text-emerald-700 tabular-nums">
                ₹{totalIncome.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Net Position Summary Row */}
        <div className={`p-4 rounded-xl mb-6 flex justify-between items-center border ${
          isDeficit ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'
        }`}>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
              Net Balance Position
            </span>
            <span className="text-sm font-semibold text-slate-800">
              Total Inflows minus Total Outflows
            </span>
          </div>
          <span className={`text-2xl font-black tabular-nums ${isDeficit ? 'text-red-700' : 'text-emerald-700'}`}>
            {isDeficit ? '−' : '+'} ₹{absBalance.toLocaleString('en-IN')}
          </span>
        </div>

        {/* QR Code Donation Appeal Card */}
        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-6 mb-8">
          <div className="flex-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-700 block mb-1">
              Patron & Donor Appeal
            </span>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Support {orgName}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md">
              Please scan the QR code to contribute directly towards educational and welfare maintenance. Every contribution helps us fulfill our mission.
            </p>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <img
              src={qrCodeUrl}
              alt="Donation QR Code"
              className="w-28 h-28 object-contain rounded-lg border border-slate-300 p-1 bg-white shadow-sm"
            />
            <span className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wider">Scan To Donate</span>
          </div>
        </div>

        {/* Signatures & Footer */}
        <div className="pt-6 border-t border-slate-300 flex justify-between items-end text-xs text-slate-600">
          <div className="text-center w-48">
            <div className="border-b border-slate-400 mb-2 h-8" />
            <span className="font-semibold text-slate-800">Secretary / Trustee</span>
          </div>
          <p className="text-[11px] text-slate-400 text-center max-w-xs">
            This statement reflects verified records for the period shown.
          </p>
          <div className="text-center w-48">
            <div className="border-b border-slate-400 mb-2 h-8" />
            <span className="font-semibold text-slate-800">President / Treasurer</span>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          PAGE 2: URDU (Bilingual with Urdu prominence)
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="noticeboard-print-page font-sans" style={{ direction: 'rtl' }}>
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
          <div className="text-right">
            <span className="text-[12px] font-bold text-slate-500 block mb-1" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
              {TRANSLATIONS.ur.docTitle}
            </span>
            <h1 className="text-2xl font-black text-slate-950" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
              {TRANSLATIONS.ur.orgTitle}
            </h1>
            <p className="text-sm font-bold text-violet-700 mt-1">
              {TRANSLATIONS.ur.periodPrefix} {periodLabel}
            </p>
          </div>
          <div className="text-left">
            <div className={`inline-flex items-center px-4 py-1.5 rounded-lg font-black text-sm tracking-wider ${
              isDeficit ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`} style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
              {isDeficit ? TRANSLATIONS.ur.deficit : TRANSLATIONS.ur.surplus}: ₹{absBalance.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Two-Column Financial Tables */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Expenses */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex justify-between items-baseline border-b-2 border-red-500 pb-2 mb-3">
              <h2 className="text-xs font-black text-red-700" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
                {TRANSLATIONS.ur.expense}
              </h2>
              <span className="text-xs font-bold text-slate-500">رقم (₹)</span>
            </div>
            <div className="space-y-2 min-h-[190px]">
              {expenseItems.length > 0 ? (
                expenseItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-baseline text-xs py-1 border-b border-slate-200/60">
                    <div className="text-right pl-2">
                      <span className="font-bold text-slate-900 block" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
                        {getLineTranslation(item.label, 'ur')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block">{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-950 tabular-nums whitespace-nowrap text-left" style={{ direction: 'ltr' }}>
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">کوئی اخراجات درج نہیں</p>
              )}
            </div>
            <div className="mt-4 pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-xs font-black text-slate-900" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
                {TRANSLATIONS.ur.totalExpense}
              </span>
              <span className="text-base font-black text-red-700 tabular-nums" style={{ direction: 'ltr' }}>
                ₹{totalExpense.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Income */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex justify-between items-baseline border-b-2 border-emerald-500 pb-2 mb-3">
              <h2 className="text-xs font-black text-emerald-700" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
                {TRANSLATIONS.ur.income}
              </h2>
              <span className="text-xs font-bold text-slate-500">رقم (₹)</span>
            </div>
            <div className="space-y-2 min-h-[190px]">
              {incomeItems.length > 0 ? (
                incomeItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-baseline text-xs py-1 border-b border-slate-200/60">
                    <div className="text-right pl-2">
                      <span className="font-bold text-slate-900 block" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
                        {getLineTranslation(item.label, 'ur')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block">{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-950 tabular-nums whitespace-nowrap text-left" style={{ direction: 'ltr' }}>
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">کوئی آمدنی درج نہیں</p>
              )}
            </div>
            <div className="mt-4 pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-xs font-black text-slate-900" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
                {TRANSLATIONS.ur.totalIncome}
              </span>
              <span className="text-base font-black text-emerald-700 tabular-nums" style={{ direction: 'ltr' }}>
                ₹{totalIncome.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Net Position Summary Row */}
        <div className={`p-4 rounded-xl mb-6 flex justify-between items-center border ${
          isDeficit ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'
        }`}>
          <div>
            <span className="text-xs font-bold text-slate-700 block" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
              {TRANSLATIONS.ur.balance}
            </span>
            <span className="text-[11px] text-slate-500 font-sans">
              Total Inflows minus Total Outflows
            </span>
          </div>
          <span className={`text-2xl font-black tabular-nums ${isDeficit ? 'text-red-700' : 'text-emerald-700'}`} style={{ direction: 'ltr' }}>
            {isDeficit ? '−' : '+'} ₹{absBalance.toLocaleString('en-IN')}
          </span>
        </div>

        {/* QR Code Donation Appeal Card */}
        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-6 mb-8">
          <div className="flex-1 text-right">
            <span className="text-[11px] font-bold text-violet-700 block mb-1" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
              مخیر حضرات سے مالی تعاون کی پرخلوص اپیل
            </span>
            <h3 className="text-base font-bold text-slate-900 mb-1" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
              {TRANSLATIONS.ur.scanToDonate}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
              {TRANSLATIONS.ur.scanSubtext}
            </p>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <img
              src={qrCodeUrl}
              alt="Donation QR Code"
              className="w-28 h-28 object-contain rounded-lg border border-slate-300 p-1 bg-white shadow-sm"
            />
            <span className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wider">Scan To Donate</span>
          </div>
        </div>

        {/* Signatures & Footer */}
        <div className="pt-6 border-t border-slate-300 flex justify-between items-end text-xs text-slate-600">
          <div className="text-center w-48">
            <div className="border-b border-slate-400 mb-2 h-8" />
            <span className="font-semibold text-slate-800" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
              {TRANSLATIONS.ur.trusteeSig}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 text-center max-w-xs" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
            {TRANSLATIONS.ur.auditedNote}
          </p>
          <div className="text-center w-48">
            <div className="border-b border-slate-400 mb-2 h-8" />
            <span className="font-semibold text-slate-800" style={{ fontFamily: TRANSLATIONS.ur.fontFamily }}>
              {TRANSLATIONS.ur.treasurerSig}
            </span>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          PAGE 3: HINDI (Bilingual with Hindi prominence)
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="noticeboard-print-page font-sans">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
          <div>
            <span className="text-[12px] font-bold text-slate-500 block mb-1" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
              {TRANSLATIONS.hi.docTitle}
            </span>
            <h1 className="text-2xl font-black text-slate-950" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
              {TRANSLATIONS.hi.orgTitle}
            </h1>
            <p className="text-sm font-bold text-violet-700 mt-1">
              {TRANSLATIONS.hi.periodPrefix} {periodLabel}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-4 py-1.5 rounded-lg font-black text-sm tracking-wider ${
              isDeficit ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`} style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
              {isDeficit ? TRANSLATIONS.hi.deficit : TRANSLATIONS.hi.surplus}: ₹{absBalance.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Two-Column Financial Tables */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Expenses */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex justify-between items-baseline border-b-2 border-red-500 pb-2 mb-3">
              <h2 className="text-xs font-black text-red-700" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
                {TRANSLATIONS.hi.expense}
              </h2>
              <span className="text-xs font-bold text-slate-500">राशि (₹)</span>
            </div>
            <div className="space-y-2 min-h-[190px]">
              {expenseItems.length > 0 ? (
                expenseItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-baseline text-xs py-1 border-b border-slate-200/60">
                    <div className="pr-2">
                      <span className="font-bold text-slate-900 block" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
                        {getLineTranslation(item.label, 'hi')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block">{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-950 tabular-nums whitespace-nowrap">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">कोई खर्च दर्ज नहीं</p>
              )}
            </div>
            <div className="mt-4 pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-xs font-black text-slate-900" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
                {TRANSLATIONS.hi.totalExpense}
              </span>
              <span className="text-base font-black text-red-700 tabular-nums">
                ₹{totalExpense.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Income */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex justify-between items-baseline border-b-2 border-emerald-500 pb-2 mb-3">
              <h2 className="text-xs font-black text-emerald-700" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
                {TRANSLATIONS.hi.income}
              </h2>
              <span className="text-xs font-bold text-slate-500">राशि (₹)</span>
            </div>
            <div className="space-y-2 min-h-[190px]">
              {incomeItems.length > 0 ? (
                incomeItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-baseline text-xs py-1 border-b border-slate-200/60">
                    <div className="pr-2">
                      <span className="font-bold text-slate-900 block" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
                        {getLineTranslation(item.label, 'hi')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block">{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-950 tabular-nums whitespace-nowrap">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">कोई आय दर्ज नहीं</p>
              )}
            </div>
            <div className="mt-4 pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-xs font-black text-slate-900" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
                {TRANSLATIONS.hi.totalIncome}
              </span>
              <span className="text-base font-black text-emerald-700 tabular-nums">
                ₹{totalIncome.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Net Position Summary Row */}
        <div className={`p-4 rounded-xl mb-6 flex justify-between items-center border ${
          isDeficit ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'
        }`}>
          <div>
            <span className="text-xs font-bold text-slate-700 block" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
              {TRANSLATIONS.hi.balance}
            </span>
            <span className="text-[11px] text-slate-500 font-sans">
              Total Inflows minus Total Outflows
            </span>
          </div>
          <span className={`text-2xl font-black tabular-nums ${isDeficit ? 'text-red-700' : 'text-emerald-700'}`}>
            {isDeficit ? '−' : '+'} ₹{absBalance.toLocaleString('en-IN')}
          </span>
        </div>

        {/* QR Code Donation Appeal Card */}
        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-6 mb-8">
          <div className="flex-1">
            <span className="text-[11px] font-bold text-violet-700 block mb-1" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
              सहयोग एवं दान की विनम्र अपील
            </span>
            <h3 className="text-base font-bold text-slate-900 mb-1" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
              {TRANSLATIONS.hi.scanToDonate}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
              {TRANSLATIONS.hi.scanSubtext}
            </p>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <img
              src={qrCodeUrl}
              alt="Donation QR Code"
              className="w-28 h-28 object-contain rounded-lg border border-slate-300 p-1 bg-white shadow-sm"
            />
            <span className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wider">Scan To Donate</span>
          </div>
        </div>

        {/* Signatures & Footer */}
        <div className="pt-6 border-t border-slate-300 flex justify-between items-end text-xs text-slate-600">
          <div className="text-center w-48">
            <div className="border-b border-slate-400 mb-2 h-8" />
            <span className="font-semibold text-slate-800" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
              {TRANSLATIONS.hi.trusteeSig}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 text-center max-w-xs" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
            {TRANSLATIONS.hi.auditedNote}
          </p>
          <div className="text-center w-48">
            <div className="border-b border-slate-400 mb-2 h-8" />
            <span className="font-semibold text-slate-800" style={{ fontFamily: TRANSLATIONS.hi.fontFamily }}>
              {TRANSLATIONS.hi.treasurerSig}
            </span>
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════════════════════════════════════
          PAGE 4: MARATHI (Bilingual with Marathi prominence)
          ═════════════════════════════════════════════════════════════════════ */}
      <section className="noticeboard-print-page font-sans">
        {/* Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
          <div>
            <span className="text-[12px] font-bold text-slate-500 block mb-1" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
              {TRANSLATIONS.mr.docTitle}
            </span>
            <h1 className="text-2xl font-black text-slate-950" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
              {TRANSLATIONS.mr.orgTitle}
            </h1>
            <p className="text-sm font-bold text-violet-700 mt-1">
              {TRANSLATIONS.mr.periodPrefix} {periodLabel}
            </p>
          </div>
          <div className="text-right">
            <div className={`inline-flex items-center px-4 py-1.5 rounded-lg font-black text-sm tracking-wider ${
              isDeficit ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`} style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
              {isDeficit ? TRANSLATIONS.mr.deficit : TRANSLATIONS.mr.surplus}: ₹{absBalance.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Two-Column Financial Tables */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Expenses */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex justify-between items-baseline border-b-2 border-red-500 pb-2 mb-3">
              <h2 className="text-xs font-black text-red-700" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
                {TRANSLATIONS.mr.expense}
              </h2>
              <span className="text-xs font-bold text-slate-500">रक्कम (₹)</span>
            </div>
            <div className="space-y-2 min-h-[190px]">
              {expenseItems.length > 0 ? (
                expenseItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-baseline text-xs py-1 border-b border-slate-200/60">
                    <div className="pr-2">
                      <span className="font-bold text-slate-900 block" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
                        {getLineTranslation(item.label, 'mr')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block">{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-950 tabular-nums whitespace-nowrap">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">कोणताही खर्च नोंदवलेला नाही</p>
              )}
            </div>
            <div className="mt-4 pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-xs font-black text-slate-900" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
                {TRANSLATIONS.mr.totalExpense}
              </span>
              <span className="text-base font-black text-red-700 tabular-nums">
                ₹{totalExpense.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Income */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <div className="flex justify-between items-baseline border-b-2 border-emerald-500 pb-2 mb-3">
              <h2 className="text-xs font-black text-emerald-700" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
                {TRANSLATIONS.mr.income}
              </h2>
              <span className="text-xs font-bold text-slate-500">रक्कम (₹)</span>
            </div>
            <div className="space-y-2 min-h-[190px]">
              {incomeItems.length > 0 ? (
                incomeItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-baseline text-xs py-1 border-b border-slate-200/60">
                    <div className="pr-2">
                      <span className="font-bold text-slate-900 block" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
                        {getLineTranslation(item.label, 'mr')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans block">{item.label}</span>
                    </div>
                    <span className="font-bold text-slate-950 tabular-nums whitespace-nowrap">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">कोणतीही जमा नोंदवलेली नाही</p>
              )}
            </div>
            <div className="mt-4 pt-2 border-t-2 border-slate-900 flex justify-between items-baseline">
              <span className="text-xs font-black text-slate-900" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
                {TRANSLATIONS.mr.totalIncome}
              </span>
              <span className="text-base font-black text-emerald-700 tabular-nums">
                ₹{totalIncome.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Net Position Summary Row */}
        <div className={`p-4 rounded-xl mb-6 flex justify-between items-center border ${
          isDeficit ? 'bg-red-50 border-red-300' : 'bg-emerald-50 border-emerald-300'
        }`}>
          <div>
            <span className="text-xs font-bold text-slate-700 block" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
              {TRANSLATIONS.mr.balance}
            </span>
            <span className="text-[11px] text-slate-500 font-sans">
              Total Inflows minus Total Outflows
            </span>
          </div>
          <span className={`text-2xl font-black tabular-nums ${isDeficit ? 'text-red-700' : 'text-emerald-700'}`}>
            {isDeficit ? '−' : '+'} ₹{absBalance.toLocaleString('en-IN')}
          </span>
        </div>

        {/* QR Code Donation Appeal Card */}
        <div className="border border-slate-300 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-6 mb-8">
          <div className="flex-1">
            <span className="text-[11px] font-bold text-violet-700 block mb-1" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
              आर्थिक मदत व देणगीचे नम्र आवाहन
            </span>
            <h3 className="text-base font-bold text-slate-900 mb-1" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
              {TRANSLATIONS.mr.scanToDonate}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
              {TRANSLATIONS.mr.scanSubtext}
            </p>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <img
              src={qrCodeUrl}
              alt="Donation QR Code"
              className="w-28 h-28 object-contain rounded-lg border border-slate-300 p-1 bg-white shadow-sm"
            />
            <span className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wider">Scan To Donate</span>
          </div>
        </div>

        {/* Signatures & Footer */}
        <div className="pt-6 border-t border-slate-300 flex justify-between items-end text-xs text-slate-600">
          <div className="text-center w-48">
            <div className="border-b border-slate-400 mb-2 h-8" />
            <span className="font-semibold text-slate-800" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
              {TRANSLATIONS.mr.trusteeSig}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 text-center max-w-xs" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
            {TRANSLATIONS.mr.auditedNote}
          </p>
          <div className="text-center w-48">
            <div className="border-b border-slate-400 mb-2 h-8" />
            <span className="font-semibold text-slate-800" style={{ fontFamily: TRANSLATIONS.mr.fontFamily }}>
              {TRANSLATIONS.mr.treasurerSig}
            </span>
          </div>
        </div>
      </section>

    </div>
  );
}
