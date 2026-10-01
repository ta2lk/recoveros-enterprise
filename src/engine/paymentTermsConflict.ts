export interface PaymentTermsConflictInput {
  invoiceId: string;
  contractTerms: string;
  systemTerms: string;
  invoiceDate: string;
  paymentDate?: string;
  invoiceAmount: number;
  paidAmount?: number;
  currency: string;
}

export interface PaymentTermsConflictResult {
  invoiceId: string;
  conflict: boolean;
  contractNetDays: number;
  systemNetDays: number;
  earlyPaymentDays: number;
  estimatedWorkingCapitalCost: number;
  reason: string;
}

function parseNetDays(terms: string): number {
  const match = terms.match(/net\s*(\d+)/i);
  if (!match) throw new Error(`PAYMENT_TERMS_UNPARSEABLE: ${terms}`);
  return Number(match[1]);
}

function differenceInDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('PAYMENT_DATE_INVALID');
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function detectPaymentTermsConflict(input: PaymentTermsConflictInput): PaymentTermsConflictResult {
  if (input.invoiceAmount < 0 || (input.paidAmount ?? input.invoiceAmount) < 0) throw new Error('PAYMENT_AMOUNT_INVALID');
  const contractNetDays = parseNetDays(input.contractTerms);
  const systemNetDays = parseNetDays(input.systemTerms);
  const paymentDays = input.paymentDate ? differenceInDays(input.invoiceDate, input.paymentDate) : undefined;
  const earlyPaymentDays = paymentDays === undefined ? 0 : Math.max(0, contractNetDays - paymentDays);
  const conflict = systemNetDays < contractNetDays || earlyPaymentDays > 0;
  const paidAmount = input.paidAmount ?? input.invoiceAmount;
  const estimatedWorkingCapitalCost = earlyPaymentDays > 0 ? Math.round((paidAmount * earlyPaymentDays) / Math.max(contractNetDays, 1) * 0.01 * 100) / 100 : 0;
  return { invoiceId: input.invoiceId, conflict, contractNetDays, systemNetDays, earlyPaymentDays, estimatedWorkingCapitalCost, reason: conflict ? `Contract Net ${contractNetDays} conflicts with system Net ${systemNetDays}${earlyPaymentDays ? `; paid ${earlyPaymentDays} days early.` : '.'}` : 'Payment terms match contract and no unapproved early payment was detected.' };
}
