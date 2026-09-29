import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from './en';
import { ar } from './ar';

export type Language = 'en' | 'ar';

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  isRtl: boolean;
  t: typeof en;
  formatCurrency: (amount: number, currency?: string) => string;
  formatNumber: (num: number) => string;
  formatDate: (dateString: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('recoveros_lang');
    return saved === 'ar' || saved === 'en' ? saved : 'en';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('recoveros_lang', newLang);
  };

  const isRtl = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  }, [lang, isRtl]);

  const t = lang === 'ar' ? ar : en;

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  return (
    <I18nContext.Provider
      value={{
        lang,
        setLang,
        isRtl,
        t,
        formatCurrency,
        formatNumber,
        formatDate,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
};
