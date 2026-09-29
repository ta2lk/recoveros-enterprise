import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Lock, Key, ShieldCheck, Check, Mail, Phone, MapPin, Send } from 'lucide-react';

interface PublicPageProps {
  onLaunchConsole: () => void;
}

export const SecurityPage: React.FC<PublicPageProps> = ({ onLaunchConsole }) => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
          Enterprise Security, Privacy & Isolation
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-2">
          Designed with GDPR principles, sovereign multi-tenancy, and immutable cryptographic audit trails
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3">
          <Lock className="w-6 h-6 text-emerald-600" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Logical Tenant Isolation
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Every customer resides in a logically partitioned tenant. No cross-tenant data leakage is physically or logically permitted, audited continuously by automated test harnesses.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3">
          <Key className="w-6 h-6 text-sky-600" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Encryption In Transit & At Rest
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            All database tables and document storage are encrypted using AES-256. All web and API traffic is restricted to TLS 1.3 with strict HTTP Strict Transport Security (HSTS).
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Prompt Injection Defenses
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
            External invoices and emails are quarantined as untrusted data. Model context enforces structural boundary isolation; no document can escalate privileges or override system policies.
          </p>
        </div>
      </div>
    </div>
  );
};

export const PricingPage: React.FC<PublicPageProps> = ({ onLaunchConsole }) => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12 text-center">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
          Transparent, Performance-Driven Pricing
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-2">
          We only earn when you recover actual cash into your bank account.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
        <div className="p-6 bg-white dark:bg-neutral-900 border-2 border-emerald-500 rounded-2xl space-y-4 shadow-md">
          <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
            Standard Contingency
          </div>
          <div className="text-3xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
            20% <span className="text-xs font-normal text-neutral-500">of recovered cash</span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Ideal for mid-market enterprises with $10M – $250M in annual procurement spend.
          </p>
          <div className="space-y-2 text-xs pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Full automated 4-way matching pipeline</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Configurable approval thresholds ($500 auto-dispatch)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Zero setup fees or recurring software costs</span>
            </div>
          </div>
          <Button variant="primary" size="md" className="w-full" onClick={onLaunchConsole}>
            Get Started
          </Button>
        </div>

        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-4">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            Enterprise Tiered
          </div>
          <div className="text-3xl font-bold font-mono text-neutral-900 dark:text-neutral-100">
            12% – 18% <span className="text-xs font-normal text-neutral-500">volume tiered</span>
          </div>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Tailored for multinational organizations with &gt;$250M annual disbursements and high transaction density.
          </p>
          <div className="space-y-2 text-xs pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Dedicated forensic recovery audit director</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Custom ERP connectors & on-premise gateway option</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Custom SLA and bespoke recovery workflows</span>
            </div>
          </div>
          <Button variant="outline" size="md" className="w-full" onClick={onLaunchConsole}>
            Contact Enterprise Sales
          </Button>
        </div>
      </div>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
          Contact Enterprise Treasury Solutions
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-2">
          Speak with our forensic audit partners regarding your organization's spend profile
        </p>
      </div>

      {submitted ? (
        <div className="p-8 text-center bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
            Audit Request Received
          </h3>
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Our enterprise forensic recovery team will review your parameters and follow up within 1 business day.
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
          className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs space-y-4 text-xs"
        >
          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="Sarah Jenkins, CPA"
              className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Corporate Email Address
            </label>
            <input
              type="email"
              required
              placeholder="cfo@company.com"
              className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Estimated Annual Accounts Payable Spend
            </label>
            <select className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100">
              <option>$5M – $25M</option>
              <option>$25M – $100M</option>
              <option>$100M – $500M</option>
              <option>&gt; $500M</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Primary Focus Areas
            </label>
            <textarea
              rows={3}
              placeholder="E.g. Duplicate payments, missed prompt discounts, freight overcharges..."
              className="w-full py-2 px-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full">
            <Send className="w-4 h-4" />
            <span>Request Diagnostic AP Audit</span>
          </Button>
        </form>
      )}
    </div>
  );
};

export const IntegrationsPage: React.FC<PublicPageProps> = ({ onLaunchConsole }) => {
  const connectors = [
    {
      name: 'Oracle NetSuite ERP',
      category: 'Enterprise ERP',
      desc: 'SuiteTalk REST & SOAP Web Services. Continuous read-only ledger synchronization of Purchase Orders, Vendor Bills, and Disbursements.',
      auth: 'Token-Based Authentication (TBA) & OAuth 2.0',
    },
    {
      name: 'SAP S/4HANA & ECC',
      category: 'Enterprise ERP',
      desc: 'BAPI, IDoc, and OData APIs. Ingests MM (Materials Management) and FI (Financial Accounting) documents with cryptographic zero-egress security.',
      auth: 'SAP NetWeaver Gateway / Mutual TLS',
    },
    {
      name: 'Intuit QuickBooks Online',
      category: 'Mid-Market Accounting',
      desc: 'REST API v3. Synchronizes bills, bill payments, vendors, and account credit memos with incremental webhooks.',
      auth: 'OAuth 2.0 PKCE Flow',
    },
    {
      name: 'Xero Accounting',
      category: 'Cloud Accounting',
      desc: 'API v2. Ingests invoices, credit notes, and bank transactions with automated rate-limit backoff.',
      auth: 'OAuth 2.0 Standard',
    },
    {
      name: 'Coupa & Workday Procurement',
      category: 'Procure-to-Pay',
      desc: 'Continuous ingestion of 3-way match exceptions, approval chains, and digital invoice archives.',
      auth: 'REST API Key & OpenID Connect',
    },
    {
      name: 'Direct Open Banking Treasury Feeds',
      category: 'Cash Settlement',
      desc: 'Plaid, Tarabut Gateway, and Direct SWIFT/ISO 20022 camt.053 statements to verify cash deposit into treasury.',
      auth: 'FAPI / Open Banking Certificate Authority',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
          Native ERP & Financial Connectors
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-2">
          Read-only, zero-trust API connections engineered for enterprise audit compliance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {connectors.map((c, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                {c.name}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                {c.category}
              </span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {c.desc}
            </p>
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-[11px] font-mono text-neutral-400">
              Auth: {c.auth}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pt-6">
        <Button variant="primary" size="lg" onClick={onLaunchConsole}>
          <span>Connect Your First Data Source</span>
        </Button>
      </div>
    </div>
  );
};
