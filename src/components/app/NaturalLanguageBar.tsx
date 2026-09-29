import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { useTenant } from '../../store/TenantContext';
import { Sparkles, ArrowRight, ShieldAlert, Check } from 'lucide-react';
import { Button } from '../ui/Button';

export const NaturalLanguageBar: React.FC = () => {
  const { t, lang, isRtl } = useI18n();
  const { executeNaturalLanguageQuery } = useTenant();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setResultMessage(null);

    try {
      const res = await executeNaturalLanguageQuery(query, lang);
      setResultMessage(lang === 'ar' ? res.messageAr : res.messageEn);
    } catch (err) {
      console.error('NL query error:', err);
    } finally {
      setLoading(false);
    }
  };

  const sampleQueries = [
    lang === 'ar'
      ? 'ابحث عن جميع المدفوعات المكررة التي تتجاوز 1000 دولار'
      : 'Find all duplicate payments above $1,000 from the last 12 months',
    lang === 'ar'
      ? 'تحقق من مكافآت الحجم التعاقدية غير المحصلة'
      : 'Check uncollected contract volume rebates',
  ];

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs mb-6">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2.5">
        <div className="relative flex-1 w-full">
          <Sparkles className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.nlPlaceholder}
            className={`w-full py-2 text-xs bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors ${
              isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={loading || !query.trim()}
          className="w-full sm:w-auto"
        >
          <span>{loading ? t.nlExecuting : t.nlButton}</span>
          <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
        </Button>
      </form>

      {/* Suggested prompts */}
      <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] text-neutral-500">
        <span className="font-medium text-neutral-400">{isRtl ? 'أمثلة مقترحة:' : 'Suggestions:'}</span>
        {sampleQueries.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setQuery(q)}
            className="hover:text-emerald-600 dark:hover:text-emerald-400 underline underline-offset-2 transition-colors cursor-pointer"
          >
            "{q}"
          </button>
        ))}
      </div>

      {/* Execution Result Banner */}
      {resultMessage && (
        <div className="mt-3.5 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold">{resultMessage}</div>
            <div className="text-[11px] opacity-80 mt-0.5">
              {isRtl
                ? 'تم تطبيق قواعد التحقق الحسابي القطعي. يمكنك مراجعة الأدلة وسلسلة المستندات في تبويب فرص الاسترداد.'
                : 'Deterministic calculation verification applied. You can review the evidence chain in the Opportunities tab.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
