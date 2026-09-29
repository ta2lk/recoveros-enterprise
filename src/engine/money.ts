/**
 * RecoverOS - Production Financial Core
 * Integer Minor Units (Cents) Arithmetic & ISO Currency Model
 * 
 * Non-negotiable Rule 1: Money is NEVER a JS float.
 * Uses integer minor units (BigInt) with explicit currency exponents and rounding modes.
 */

export type RoundingMode = 'HALF_EVEN' | 'HALF_UP' | 'FLOOR' | 'CEIL';

export interface CurrencyMetadata {
  code: string;
  exponent: number; // e.g., USD = 2, JPY = 0, KWD = 3
  symbol: string;
}

export const ISO_CURRENCIES: Record<string, CurrencyMetadata> = {
  USD: { code: 'USD', exponent: 2, symbol: '$' },
  EUR: { code: 'EUR', exponent: 2, symbol: '€' },
  GBP: { code: 'GBP', exponent: 2, symbol: '£' },
  AED: { code: 'AED', exponent: 2, symbol: 'AED ' },
  SAR: { code: 'SAR', exponent: 2, symbol: 'SAR ' },
  TRY: { code: 'TRY', exponent: 2, symbol: '₺' },
  JPY: { code: 'JPY', exponent: 0, symbol: '¥' },
  KWD: { code: 'KWD', exponent: 3, symbol: 'KD ' },
  BHD: { code: 'BHD', exponent: 3, symbol: 'BD ' },
  OMR: { code: 'OMR', exponent: 3, symbol: 'OMR ' },
};

export class Money {
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly exponent: number;

  constructor(amountMinor: bigint | number, currency: string = 'USD') {
    const meta = ISO_CURRENCIES[currency.toUpperCase()];
    if (!meta) {
      throw new Error(`FINANCIAL_INVALID_CURRENCY: Unsupported currency code '${currency}'`);
    }
    this.currency = meta.code;
    this.exponent = meta.exponent;
    this.amountMinor = typeof amountMinor === 'bigint' ? amountMinor : BigInt(Math.trunc(amountMinor));
  }

  /**
   * Instantiate from integer minor units (e.g. cents)
   */
  static fromMinor(amountMinor: bigint | number, currency: string = 'USD'): Money {
    return new Money(amountMinor, currency);
  }

  /**
   * Instantiate from major units string or number (e.g. "100.50" -> 10050 cents)
   * String parsing eliminates any floating point error before it enters the system.
   */
  static fromDecimal(
    val: string | number,
    currency: string = 'USD',
    rounding: RoundingMode = 'HALF_EVEN'
  ): Money {
    const meta = ISO_CURRENCIES[currency.toUpperCase()];
    if (!meta) {
      throw new Error(`FINANCIAL_INVALID_CURRENCY: Unsupported currency code '${currency}'`);
    }

    const str = typeof val === 'number' ? val.toFixed(meta.exponent + 6) : val.trim();
    if (!/^-?\d+(\.\d+)?$/.test(str)) {
      throw new Error(`FINANCIAL_INVALID_DECIMAL: Cannot parse '${val}' as decimal amount`);
    }

    const isNegative = str.startsWith('-');
    const cleanStr = isNegative ? str.slice(1) : str;
    const parts = cleanStr.split('.');
    const integerPart = BigInt(parts[0]);
    const fractionalPart = parts[1] || '';

    const scale = BigInt(10 ** meta.exponent);
    let minor = integerPart * scale;

    if (fractionalPart.length > 0) {
      const paddedFraction = fractionalPart.padEnd(meta.exponent + 1, '0');
      const targetDigits = paddedFraction.slice(0, meta.exponent);
      const nextDigit = parseInt(paddedFraction.charAt(meta.exponent), 10);
      const remainingDigits = paddedFraction.slice(meta.exponent + 1);
      const hasMoreNonZero = /[1-9]/.test(remainingDigits);

      let fractionalMinor = BigInt(targetDigits.length > 0 ? targetDigits : '0');

      // Apply explicit rounding mode to the last digit
      const roundUp = Money.applyRounding(
        nextDigit,
        hasMoreNonZero,
        Number(fractionalMinor % 2n),
        rounding,
        isNegative
      );

      if (roundUp) {
        fractionalMinor += 1n;
      }
      minor += fractionalMinor;
    }

    return new Money(isNegative ? -minor : minor, currency);
  }

  private static applyRounding(
    nextDigit: number,
    hasMoreNonZero: boolean,
    isOdd: number,
    mode: RoundingMode,
    isNegative: boolean
  ): boolean {
    if (nextDigit < 5) {
      return mode === 'CEIL' && isNegative === false && (nextDigit > 0 || hasMoreNonZero);
    }
    if (nextDigit > 5 || hasMoreNonZero) {
      if (mode === 'FLOOR') return isNegative;
      return true;
    }
    // Exactly 5 followed by zeros
    switch (mode) {
      case 'HALF_UP':
        return true;
      case 'HALF_EVEN':
        return isOdd === 1; // Bankers Rounding: round to nearest even integer
      case 'CEIL':
        return !isNegative;
      case 'FLOOR':
        return isNegative;
      default:
        return false;
    }
  }

  static zero(currency: string = 'USD'): Money {
    return new Money(0n, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  /**
   * Multiply by a rational ratio (numerator / denominator) with explicit rounding
   */
  multiplyRatio(
    numerator: bigint | number,
    denominator: bigint | number,
    rounding: RoundingMode = 'HALF_EVEN'
  ): Money {
    const num = BigInt(numerator);
    const den = BigInt(denominator);
    if (den === 0n) {
      throw new Error('FINANCIAL_DIVISION_BY_ZERO: Denominator cannot be zero');
    }

    const isResultNegative = (this.amountMinor < 0n) !== (num < 0n !== den < 0n);
    const absProduct = (this.amountMinor < 0n ? -this.amountMinor : this.amountMinor) * (num < 0n ? -num : num);
    const absDen = den < 0n ? -den : den;

    const quotient = absProduct / absDen;
    const remainder = absProduct % absDen;

    let roundUp = false;
    if (remainder > 0n) {
      const twiceRemainder = remainder * 2n;
      if (twiceRemainder > absDen) {
        roundUp = true;
      } else if (twiceRemainder === absDen) {
        // Halfway
        if (rounding === 'HALF_UP') roundUp = true;
        else if (rounding === 'HALF_EVEN') roundUp = quotient % 2n === 1n;
        else if (rounding === 'CEIL') roundUp = !isResultNegative;
      } else if (rounding === 'CEIL' && !isResultNegative) {
        roundUp = true;
      }
    }

    const finalAmount = quotient + (roundUp ? 1n : 0n);
    return new Money(isResultNegative ? -finalAmount : finalAmount, this.currency);
  }

  /**
   * Calculate percentage in basis points (1 basis point = 0.01% = 0.0001)
   * Example: 2% = 200 basis points
   */
  percentBasisPoints(basisPoints: number, rounding: RoundingMode = 'HALF_EVEN'): Money {
    return this.multiplyRatio(BigInt(basisPoints), 10000n, rounding);
  }

  /**
   * Calculate percentage directly (e.g. 2.5 for 2.5%)
   */
  percentage(percent: number, rounding: RoundingMode = 'HALF_EVEN'): Money {
    const bps = Math.round(percent * 100);
    return this.percentBasisPoints(bps, rounding);
  }

  abs(): Money {
    return new Money(this.amountMinor < 0n ? -this.amountMinor : this.amountMinor, this.currency);
  }

  compare(other: Money): number {
    this.assertSameCurrency(other);
    if (this.amountMinor < other.amountMinor) return -1;
    if (this.amountMinor > other.amountMinor) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  isZero(): boolean {
    return this.amountMinor === 0n;
  }

  isPositive(): boolean {
    return this.amountMinor > 0n;
  }

  isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  /**
   * Convert back to standard decimal string (e.g. "125.40")
   */
  toDecimalString(): string {
    const isNeg = this.amountMinor < 0n;
    const abs = isNeg ? -this.amountMinor : this.amountMinor;
    if (this.exponent === 0) {
      return (isNeg ? '-' : '') + abs.toString();
    }
    const scale = 10n ** BigInt(this.exponent);
    const intPart = abs / scale;
    const fracPart = (abs % scale).toString().padStart(this.exponent, '0');
    return `${isNeg ? '-' : ''}${intPart}.${fracPart}`;
  }

  /**
   * Format for UI display (audited, non-float representation)
   */
  toFormattedString(): string {
    const meta = ISO_CURRENCIES[this.currency];
    const isNeg = this.amountMinor < 0n;
    const dec = this.toDecimalString();
    const parts = (isNeg ? dec.slice(1) : dec).split('.');
    const withCommas = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const formatted = parts.length > 1 ? `${withCommas}.${parts[1]}` : withCommas;
    return `${isNeg ? '-' : ''}${meta.symbol}${formatted}`;
  }

  /**
   * Convert to number (strictly for external legacy display only, never for intermediate arithmetic)
   */
  toNumber(): number {
    return Number(this.amountMinor) / 10 ** this.exponent;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `FINANCIAL_CURRENCY_MISMATCH: Cannot operate on distinct currencies '${this.currency}' and '${other.currency}'. Convert using dated FX rates first.`
      );
    }
  }
}
