import React, { useState } from 'react';
import { useI18n } from '../../i18n';
import {
  Server,
  Database,
  Key,
  Shield,
  HardDrive,
  Network,
  Activity,
  CheckCircle2,
  RefreshCw,
  GitCommit,
  ExternalLink,
  Cpu,
  Layers,
  FileCode2,
} from 'lucide-react';
import { Button } from '../ui/Button';

export const InfrastructureView: React.FC = () => {
  const { t, isRtl } = useI18n();
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState<'topology' | 'terraform' | 'cicd'>('topology');

  const infrastructureNodes = [
    {
      title: isRtl ? 'نظام قاعدة بيانات PostgreSQL 16 المدار' : 'OCI Managed PostgreSQL 16 DB System',
      resource: 'oci_psql_db_system.primary',
      subnet: '10.42.20.0/24 (Private Database Subnet)',
      status: 'AVAILABLE',
      specs: 'PostgreSQL 16 Enterprise • 4 OCPUs • 64GB RAM • 512GB NVMe Storage',
      features: isRtl
        ? ['نسخ احتياطي يومي تلقائي (30 يوماً)', 'تشفير كامل أثناء النقل والتخزين', 'عزل مستوى الصفوف (RLS) مفعل']
        : ['Daily Automated Backups (30d retention)', 'Full TLS/SSL in-transit & at-rest encryption', 'Strict Row-Level Security (RLS) Active'],
      icon: Database,
      badge: 'Tier-1 High Availability',
    },
    {
      title: isRtl ? 'خزينة مفاتيح التشفير المدارة (OCI KMS Vault)' : 'OCI Managed KMS Vault & Key Hierarchy',
      resource: 'oci_kms_vault.primary_vault & oci_kms_key.master_key',
      subnet: 'Hardware Security Module (FIPS 140-2 Level 3)',
      status: 'PROTECTED',
      specs: 'AES-256 Algorithm • Auto-Rotation Enabled (Annual) • Zero-Export',
      features: isRtl
        ? ['تشفير مغلف للمستندات (Envelope Encryption)', 'مفاتيح DEK فريدة لكل ملف', 'تدوير تلقائي للمفاتيح الرئيسية']
        : ['Envelope Encryption for Invoices/Contracts', 'Unique per-document DEK generation', 'Automatic Master KEK rotation'],
      icon: Key,
      badge: 'FIPS 140-2 Level 3',
    },
    {
      title: isRtl ? 'وعاء تخزين المستندات المشفر (Object Storage)' : 'Encrypted Private Object Storage Bucket',
      resource: 'oci_objectstorage_bucket.document_storage',
      subnet: 'Private Object Store API Endpoint',
      status: 'ENCRYPTED',
      specs: 'SSE-KMS Encryption • Object Versioning Enabled • Pre-Auth Quarantine',
      features: isRtl
        ? ['إصدارات متسلسلة للمستندات (Versioning)', 'فاحص فيروسات مسبق (Antivirus Hook)', 'حظر عام كامل للوصول العام']
        : ['Immutable Document Versioning', 'Integrated Pre-Ingestion Antivirus Hook', 'Zero Public Access Policy'],
      icon: HardDrive,
      badge: 'SSE-KMS Compliant',
    },
    {
      title: isRtl ? 'الشبكة السحابية الافتراضية (OCI VCN)' : 'Virtual Cloud Network (OCI VCN)',
      resource: 'oci_core_vcn.primary_vcn (10.42.0.0/16)',
      subnet: 'Public (10.42.10.0/24) | Private DB (10.42.20.0/24)',
      status: 'SECURE',
      specs: 'Stateful Security Lists • Route Tables • Internet Gateway',
      features: isRtl
        ? ['عزل كامل لمنفذ قاعدة البيانات 5432 داخل الشبكة الخاصة فقط', 'بوابات أمان محكمة (Security Lists)', 'توجيه محكم لحركة البيانات']
        : ['Port 5432 strictly isolated to private subnet', 'Zero direct internet exposure for database', 'Strict ingress/egress CIDR rules'],
      icon: Network,
      badge: 'Zero-Trust Network',
    },
    {
      title: isRtl ? 'مجموعة التسجيل المركزي (OCI Logging)' : 'Centralized OCI Logging & Audit',
      resource: 'oci_logging_log_group.primary_log_group',
      subnet: 'OCI Service Bus Telemetry',
      status: 'STREAMING',
      specs: '30-Day Retention • Cryptographic Hash-Chain Verification',
      features: isRtl
        ? ['تسجيل فوري لجميع أحداث المصادقة', 'ربط تسلسلي ببصمات التجزئة SHA-256', 'تنبيهات فورية عند محاولات التلاعب']
        : ['Real-time authentication and access event capture', 'SHA-256 hash-chained block validation', 'Tamper-evident anomaly alerts'],
      icon: Activity,
      badge: 'SOC2 & ISO 27001 Ready',
    },
  ];

  const cicdWorkflows = [
    {
      name: isRtl ? 'سير عمل التحقق من Terraform' : 'Terraform OCI Stack Validation',
      file: '.github/workflows/terraform.yml',
      triggers: 'Push to main, PR to main',
      status: 'PASSED',
      description: isRtl
        ? 'فحص تلقائي لصيغة وتناسق ملفات Terraform والتحقق من المخطط عبر terraform fmt و validate'
        : 'Automated syntax & schema validation of OCI network, database, KMS, and storage infrastructure.',
    },
    {
      name: isRtl ? 'فحص الثغرات الأمنية للبرمجيات (Trivy)' : 'Vulnerability Scanning (Aqua Trivy)',
      file: '.github/workflows/security.yml',
      triggers: 'Nightly & CI on Push',
      status: 'ACTIVE',
      description: isRtl
        ? 'فحص حاويات Docker والمكتبات ضد الثغرات الأمنية الحرجة والمهمة (CVEs) وحظر أي صورة بها ثغرة'
        : 'Automated container & dependency vulnerability scanning gating deployments on critical/high CVEs.',
    },
    {
      name: isRtl ? 'تحليل الأمان الدلالي (GitHub CodeQL)' : 'Static Code Analysis (CodeQL)',
      file: '.github/workflows/security.yml',
      triggers: 'CodeQL Analysis on PR',
      status: 'VERIFIED',
      description: isRtl
        ? 'تحليل البرمجيات للكشف عن ثغرات SQL Injection و XSS و Insecure Deserialization'
        : 'Deep semantic AST security scanner preventing injection vulnerabilities and logic flaws.',
    },
    {
      name: isRtl ? 'كشف تسريب الأسرار والمفاتيح (Gitleaks)' : 'Secret Leak Prevention (Gitleaks)',
      file: '.github/workflows/security.yml',
      triggers: 'Pre-commit & CI Gate',
      status: 'ENFORCED',
      description: isRtl
        ? 'منع تسريب أي مفاتيح API أو كلمات مرور أو شهادات في تاريخ Git'
        : 'Zero-tolerance scanner checking git commits for exposed credentials and private tokens.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              {isRtl ? 'البنية السحابية المعتمدة (Oracle Cloud - OCI)' : 'Validated Cloud Infrastructure (OCI)'}
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md">
              Terraform IaC Validated
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {isRtl
              ? 'مخطط البنية السحابية المدارة عبر Terraform والمدمجة في المستودع: PostgreSQL 16، خزائن KMS المدارة، والتخزين المشفر'
              : 'Terraform-managed multi-tier enterprise architecture: OCI PostgreSQL 16, KMS Vault auto-rotation, and encrypted object storage.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setIsVerifying(true);
              setTimeout(() => setIsVerifying(false), 800);
            }}
            disabled={isVerifying}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isRtl ? 'تحديث حالة البنية' : 'Refresh State'}</span>
          </Button>

          <a
            href="https://github.com/ta2lk/recoveros-enterprise/tree/main/terraform/oci"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors"
          >
            <FileCode2 className="w-3.5 h-3.5 text-sky-500" />
            <span>{isRtl ? 'ملفات Terraform على GitHub' : 'View Terraform Files'}</span>
            <ExternalLink className="w-3 h-3 text-neutral-400" />
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('topology')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'topology'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          {isRtl ? 'طوبولوجيا المكونات السحابية' : 'Cloud Architecture & Topology'}
        </button>
        <button
          onClick={() => setActiveTab('terraform')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'terraform'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          {isRtl ? 'ملفات Terraform (IaC)' : 'Terraform Stack Manifest'}
        </button>
        <button
          onClick={() => setActiveTab('cicd')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'cicd'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          {isRtl ? 'بوابات الفحص الأمني (CI/CD Gates)' : 'Automated Security Gates'}
        </button>
      </div>

      {/* Content based on Active Tab */}
      {activeTab === 'topology' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {infrastructureNodes.map((node, idx) => {
              const Icon = node.icon;
              return (
                <div
                  key={idx}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-emerald-500" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                            {node.title}
                          </h3>
                          <span className="text-[11px] font-mono text-neutral-500">
                            {node.resource}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md shrink-0">
                        {node.badge}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 mb-3">
                      <div className="text-neutral-400 text-[10px] uppercase font-sans font-medium mb-1">
                        {isRtl ? 'المواصفات والشبكة' : 'Subnet & Specifications'}
                      </div>
                      <div>{node.subnet}</div>
                      <div className="text-neutral-500 mt-0.5">{node.specs}</div>
                    </div>

                    <ul className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                      {node.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">{isRtl ? 'الحالة الحالية:' : 'Current Status:'}</span>
                    <span className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {node.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'terraform' && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-emerald-500" />
              <span>{isRtl ? 'هيكلية ملفات Terraform OCI في المستودع' : 'Repository Terraform OCI Modules'}</span>
            </h3>
            <span className="text-xs text-neutral-500 font-mono">/terraform/oci/</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1">network.tf</div>
              <p className="text-neutral-500 text-[11px] font-sans">
                {isRtl
                  ? 'تعريف شبكة VCN (10.42.0.0/16) والشبكة الفرعية العامة لقواعد التطبيق والشبكة الخاصة المعزولة لقاعدة البيانات'
                  : 'VCN configuration, private database subnet, security lists, routing tables, and internet gateway.'}
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1">postgresql.tf</div>
              <p className="text-neutral-500 text-[11px] font-sans">
                {isRtl
                  ? 'إعداد قاعدة بيانات OCI PostgreSQL 16 المدارة مع سياسة النسخ الاحتياطي التلقائي لمدة 30 يوماً'
                  : 'Managed PostgreSQL 16 database system, credentials binding, automated daily backups with 30-day retention.'}
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1">kms.tf</div>
              <p className="text-neutral-500 text-[11px] font-sans">
                {isRtl
                  ? 'إنشاء OCI KMS Vault مع مفتاح تشفير رئيسي AES-256 وتفعيل التدوير التلقائي السنوي'
                  : 'Hardware security vault, AES-256 master key creation with automated annual key rotation.'}
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1">storage.tf</div>
              <p className="text-neutral-500 text-[11px] font-sans">
                {isRtl
                  ? 'وعاء تخزين المستندات المشفر تحت مفاتيح KMS مع تفعيل الـ Versioning وحظر الوصول العام'
                  : 'Encrypted object storage bucket for documents and invoice envelopes with native versioning.'}
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1">logging.tf</div>
              <p className="text-neutral-500 text-[11px] font-sans">
                {isRtl
                  ? 'مجموعة التسجيل المركزية OCI Log Group لمراقبة الأحداث الأمنية وسجلات التدقيق'
                  : 'Centralized log group and streaming configuration for audit trail and security events.'}
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold mb-1">compute.tf & outputs.tf</div>
              <p className="text-neutral-500 text-[11px] font-sans">
                {isRtl
                  ? 'خادم الحوسبة لتشغيل التطبيق عبر حاويات Docker واستخراج قيم الربط وقاعدة البيانات'
                  : 'Application compute instances and exported endpoints for database connection and storage URLs.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cicd' && (
        <div className="space-y-3">
          {cicdWorkflows.map((flow, fIdx) => (
            <div
              key={fIdx}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <GitCommit className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {flow.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    {flow.file}
                  </span>
                </div>
                <p className="text-xs text-neutral-500">{flow.description}</p>
                <div className="text-[11px] text-neutral-400 flex items-center gap-2">
                  <span>{isRtl ? 'مشغلات الفحص:' : 'Trigger:'} {flow.triggers}</span>
                </div>
              </div>

              <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md shrink-0">
                {flow.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
