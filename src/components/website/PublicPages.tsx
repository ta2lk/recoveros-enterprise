import React from 'react';
import { useI18n } from '../../i18n';
import { Button } from '../ui/Button';
import { Check, ShieldCheck, Database, Search, Calculator, FileCheck2, ArrowRight } from 'lucide-react';

interface PublicPageProps {
  onLaunchConsole: () => void;
}

export const HowItWorks: React.FC<PublicPageProps> = ({ onLaunchConsole }) => {
  const { t, isRtl } = useI18n();

  const steps = [
    {
      num: '01',
      title: 'Zero-Egress Document & API Ingestion',
      desc: 'Connect your ERP (NetSuite, SAP, QuickBooks, Xero) or drop scanned invoices, contracts, and bills of lading. Data is quarantined and processed in your dedicated tenant silo.',
    },
    {
      num: '02',
      title: 'Multi-Agent Autonomous Reconciliation',
      desc: 'Specialized agents (Discovery, Contract, Invoice, Freight) inspect line items, apply OCR normalization, and extract rebate clauses.',
    },
    {
      num: '03',
      title: 'Deterministic Code-Math Verification',
      desc: 'No LLM calculates financial numbers. Code-based decimal arithmetic computes exact overpayments down to the cent.',
    },
    {
      num: '04',
      title: 'Evidence Packaging & Chain of Custody',
      desc: 'Produces incontrovertible audit trails referencing original contract clauses, PO line numbers, and bank disbursement timestamps.',
    },
    {
      num: '05',
      title: 'Approval Gated Notice Dispatch',
      desc: 'Claims under $500 can be autonomously dispatched. Claims exceeding $5,000 mandate explicit CFO or Finance Manager sign-off.',
    },
    {
      num: '06',
      title: 'Verified Treasury Settlement',
      desc: 'Recovery agents reconcile supplier credit memos or direct bank wire receipts before recording verified revenue.',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
          How RecoverOS Works
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-2">
          An engineering breakdown of our autonomous revenue recovery lifecycle
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((s) => (
          <div
            key={s.num}
            className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs flex items-start gap-5"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono font-bold flex items-center justify-center shrink-0 text-sm">
              {s.num}
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                {s.title}
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                {s.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pt-6">
        <Button variant="primary" size="lg" onClick={onLaunchConsole}>
          <span>Launch Verification Console</span>
          <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
        </Button>
      </div>
    </div>
  );
};

export const RecoveryTypes: React.FC<PublicPageProps> = ({ onLaunchConsole }) => {
  const categories = [
    {
      title: 'Supplier Overpayments',
      desc: 'Invoices billed higher than authorized purchase orders or contract rate schedules.',
      stat: '0.5% – 1.5% of total annual AP volume',
    },
    {
      title: 'Duplicate Disbursements',
      desc: 'Identical vendor invoices paid twice via different payment rails (e.g. check and ACH wire) or with subtle invoice number padding.',
      stat: '0.1% – 0.8% of processed invoices (IOFM benchmark)',
    },
    {
      title: 'Missed Prompt-Payment Discounts',
      desc: 'Contractual early-settlement terms (e.g. 2/10 Net 30) where payments cleared within 10 days but full gross was disbursed.',
      stat: 'Average $480 – $2,400 per eligible supplier',
    },
    {
      title: 'Contract Volume Rebates',
      desc: 'Annual incentive rebates earned upon reaching cumulative procurement spend tiers that vendors omit to issue.',
      stat: '2.0% – 5.0% of qualifying annual category spend',
    },
    {
      title: 'Freight & Carrier Overcharges',
      desc: 'Unauthorized accessorial fees, duplicate tracking bills, and erroneous fuel surcharge calculations not in master tariffs.',
      stat: '1% – 5% of enterprise logistics expenditure (Cass / Loop)',
    },
    {
      title: 'SLA Penalties & Warranty Credits',
      desc: 'Vendor downtime, late delivery service level agreement penalties, and uncollected RMA equipment credits.',
      stat: '100% auditable via delivery receipts',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-12">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-100">
          Supported Recovery Categories
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-2">
          Objectively verifiable financial leakage vectors recovered by RecoverOS
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((c, i) => (
          <div
            key={i}
            className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs space-y-2"
          >
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {c.title}
            </h3>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {c.desc}
            </p>
            <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              Benchmark: {c.stat}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pt-6">
        <Button variant="primary" size="lg" onClick={onLaunchConsole}>
          <span>Scan Your Ledgers for Leakage</span>
        </Button>
      </div>
    </div>
  );
};
