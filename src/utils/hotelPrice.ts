import { HotelBooking } from '../types';

export interface HotelPaymentStep {
  amount: number;
  rawSegment: string;
  note?: string;
}

export interface ParsedHotelPrice {
  raw: string;
  cleanExpression: string | null;
  total: number | null;
  steps: HotelPaymentStep[];
  hasMultiplePayments: boolean;
}

/**
 * Parses a hotel price string that may contain '+' separated payments
 * (e.g. "200 + 100 + 50" or "200 + 100 (2 nights ext)")
 * and calculates the total amount paid and individual payment steps.
 */
export function parseHotelPriceInput(input: string | number | null | undefined): ParsedHotelPrice {
  if (input === null || input === undefined) {
    return {
      raw: '',
      cleanExpression: null,
      total: null,
      steps: [],
      hasMultiplePayments: false,
    };
  }

  const raw = String(input);
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      raw,
      cleanExpression: null,
      total: null,
      steps: [],
      hasMultiplePayments: false,
    };
  }

  // Split by '+' to trace each individual payment
  const segments = trimmed.split('+');
  const steps: HotelPaymentStep[] = [];

  for (const seg of segments) {
    const cleanSeg = seg.trim();
    if (!cleanSeg) continue;
    // Match the first number in this segment (supports decimals like 150.50 or comma-formatted 1,200)
    const normalizedSeg = cleanSeg.replace(/,/g, '');
    const match = normalizedSeg.match(/-?\d+(\.\d+)?/);
    if (match) {
      const amount = parseFloat(match[0]);
      if (!isNaN(amount)) {
        // Extract any optional note after the number
        const remainder = cleanSeg.replace(match[0], '').trim().replace(/^\(|\)$/g, '').trim();
        steps.push({
          amount: Math.round(amount * 100) / 100,
          rawSegment: cleanSeg,
          note: remainder || undefined,
        });
      }
    }
  }

  if (steps.length === 0) {
    return {
      raw,
      cleanExpression: trimmed,
      total: null,
      steps: [],
      hasMultiplePayments: false,
    };
  }

  const sum = steps.reduce((acc, s) => acc + s.amount, 0);
  const total = Math.round(sum * 100) / 100;
  const cleanExpression = steps.map((s) => s.rawSegment).join(' + ');

  return {
    raw,
    cleanExpression,
    total,
    steps,
    hasMultiplePayments: steps.length > 1 || trimmed.includes('+'),
  };
}

/**
 * Returns the editable price string for a HotelBooking, preferring price_details
 * (which preserves the "200 + 100" history) and falling back to total_price.
 */
export function getBookingPriceString(booking?: Partial<HotelBooking> | null): string {
  if (!booking) return '';
  if (booking.price_details && String(booking.price_details).trim()) {
    return String(booking.price_details).trim();
  }
  if (booking.total_price !== null && booking.total_price !== undefined) {
    return String(booking.total_price);
  }
  return '';
}
