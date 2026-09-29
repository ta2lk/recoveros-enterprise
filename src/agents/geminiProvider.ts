/**
 * RecoverOS - Abstracted LLM Provider (Google Gen AI SDK)
 * 
 * Rules:
 * 1. LLMs are used for interpretation, drafting, and summarization only.
 * 2. Strictly prohibited from inventing financial numbers or changing ledger truth.
 * 3. Applies PromptDefense data boundaries.
 */

import { GoogleGenAI } from '@google/genai';
import { PromptDefense } from '../security/promptDefense';

export class GeminiAgentProvider {
  private static ai: GoogleGenAI | null = null;

  private static getClient(): GoogleGenAI | null {
    if (this.ai) return this.ai;
    const apiKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      try {
        this.ai = new GoogleGenAI({ apiKey });
      } catch (err) {
        console.warn('Failed to initialize GoogleGenAI client:', err);
      }
    }
    return this.ai;
  }

  /**
   * Draft a formal, courteous, and legally-grounded recovery demand letter
   */
  static async draftClaimNotice(params: {
    supplierName: string;
    claimNumber: string;
    invoiceNumbers: string[];
    contractReference?: string;
    recoverableAmount: number;
    currency: string;
    categoryTitle: string;
    evidenceSummary: string;
    language: 'en' | 'ar';
  }): Promise<{ subject: string; body: string }> {
    const ai = this.getClient();
    const isArabic = params.language === 'ar';

    const defaultSubjectEn = `Financial Settlement Request: Claim #${params.claimNumber} - Overpayment Rectification (${params.supplierName})`;
    const defaultSubjectAr = `طلب تسوية مالية: مطالبة رقم #${params.claimNumber} - تصحيح فروقات سداد (${params.supplierName})`;

    const defaultBodyEn = `Dear Accounts Receivable & Vendor Relations Team at ${params.supplierName},

During our internal financial audit reconciliation, our automated compliance system verified an overpayment discrepancy regarding your account:

- Reference Claim: #${params.claimNumber}
- Category: ${params.categoryTitle}
- Discrepancy Amount: ${params.currency} ${params.recoverableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
- Affected Records: ${params.invoiceNumbers.join(', ')}
${params.contractReference ? `- Governing Agreement: ${params.contractReference}` : ''}

Evidence Summary:
${params.evidenceSummary}

In accordance with our contractual terms and standard accounting practices, we kindly request the issuance of a formal Credit Memo or direct ACH reimbursement for the net difference within 14 business days.

Detailed transaction documentation, purchase orders, and payment vouchers are attached to this dossier.

Sincerely,
Enterprise Revenue Recovery & Accounts Payable Treasury
RecoverOS Verified Audit Platform`;

    const defaultBodyAr = `السادة إدارة الحسابات المدينة وعلاقات الموردين بشركة ${params.supplierName} المحترمين،

تحية طيبة وبعد،

أظهرت أعمال المطابقة والتدقيق المالي المحاسبي الآلية وجود فروقات مالية ومبالغ مستحقة للرد لصالح شركتنا بموجب السجلات التالية:

- رقم المطالبة المعتمدة: #${params.claimNumber}
- تصنيف الاسترداد: ${params.categoryTitle}
- المبلغ المستحق: ${params.currency} ${params.recoverableAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
- الفواتير المرتبطة: ${params.invoiceNumbers.join(', ')}
${params.contractReference ? `- العقد المرجعي: ${params.contractReference}` : ''}

ملخص الأدلة الموثقة:
${params.evidenceSummary}

نأمل التكرم بمراجعة المرفقات وإصدار إشعار دائن (Credit Memo) أو إجراء تحويل بنكي بالمبلغ المستحق خلال 14 يوم عمل وفقاً للأعراف التجارية وشروط التعاقد.

وتفضلوا بقبول فائق التقدير والاحترام،
إدارة الخزينة والرقابة المالية
منصة ريكوفر أوس (RecoverOS)`;

    if (!ai) {
      return {
        subject: isArabic ? defaultSubjectAr : defaultSubjectEn,
        body: isArabic ? defaultBodyAr : defaultBodyEn,
      };
    }

    try {
      const sanitizedSummary = PromptDefense.sanitizeExternalData(params.evidenceSummary);
      const safeBoundary = PromptDefense.wrapWithSafeDataBoundary(sanitizedSummary.sanitizedText);

      const prompt = `You are a Senior Corporate Financial Recovery Officer. Draft an enterprise claim notice.
Language: ${isArabic ? 'Arabic' : 'English'}
Supplier: ${params.supplierName}
Claim Number: ${params.claimNumber}
Amount: ${params.currency} ${params.recoverableAmount}
Category: ${params.categoryTitle}
Invoices: ${params.invoiceNumbers.join(', ')}
${safeBoundary}

Provide output in JSON format:
{
  "subject": "string",
  "body": "string"
}
Do NOT hallucinate numbers. Use strictly the provided amount.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2, // Low temperature for factual precision
        },
      });

      const text = response.text || '';
      const parsed = JSON.parse(text);
      if (parsed.subject && parsed.body) {
        return {
          subject: parsed.subject,
          body: parsed.body,
        };
      }
    } catch (err) {
      console.warn('Gemini drafting fallback invoked:', err);
    }

    return {
      subject: isArabic ? defaultSubjectAr : defaultSubjectEn,
      body: isArabic ? defaultBodyAr : defaultBodyEn,
    };
  }

  /**
   * Natural Language Query Intent Parser with safety checks
   */
  static parseNaturalLanguageIntent(query: string, language: 'en' | 'ar'): {
    action: 'DISCOVER_OVERPAYMENTS' | 'DISCOVER_DUPLICATES' | 'CHECK_REBATES' | 'CHECK_FREIGHT' | 'RUN_FULL_AUDIT';
    filterAmount?: number;
    filterSupplier?: string;
    isHighRisk: boolean;
    explanationEn: string;
    explanationAr: string;
  } {
    const q = query.toLowerCase();

    let action: 'DISCOVER_OVERPAYMENTS' | 'DISCOVER_DUPLICATES' | 'CHECK_REBATES' | 'CHECK_FREIGHT' | 'RUN_FULL_AUDIT' = 'RUN_FULL_AUDIT';
    let isHighRisk = false;

    if (q.includes('duplicate') || q.includes('مكرر') || q.includes('سداد مكرر')) {
      action = 'DISCOVER_DUPLICATES';
    } else if (q.includes('rebate') || q.includes('خصم') || q.includes('مكافأة') || q.includes('حجم')) {
      action = 'CHECK_REBATES';
    } else if (q.includes('freight') || q.includes('شحن') || q.includes('لوجست')) {
      action = 'CHECK_FREIGHT';
    } else if (q.includes('overpay') || q.includes('زائد') || q.includes('فروق')) {
      action = 'DISCOVER_OVERPAYMENTS';
    }

    // Extract potential amount filter (e.g., $1000 or 1000)
    const amountMatch = query.match(/(?:\$|usd|eur|sar|aed)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i);
    let filterAmount: number | undefined = undefined;
    if (amountMatch && amountMatch[1]) {
      filterAmount = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (filterAmount > 5000) {
        isHighRisk = true; // High financial value workflow
      }
    }

    return {
      action,
      filterAmount,
      isHighRisk,
      explanationEn: `Autonomous pipeline plan: Query ${action.replace(/_/g, ' ')}${filterAmount ? ` filtering for differences > $${filterAmount}` : ''}. Requires deterministic math verification before drafting claims.`,
      explanationAr: `خطة المسار الذاتي: تنفيذ استعلام ${action} ${filterAmount ? `مع تصفية المبالغ الأكبر من ${filterAmount}` : ''}. سيتم التحقق الحسابي القطعي قبل إنشاء أي مطالبات.`,
    };
  }
}
