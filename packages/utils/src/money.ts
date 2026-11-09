import { ServiceFeeMethod, type ServiceFeeConfigDto, type OrderType } from '@ikki-dost/shared-types';

/**
 * Money helpers. ALL money is integer UZS. Never use floats for money.
 * Quantities may be decimal (kg) and are converted with round-half-up.
 */

/** Round a number to the nearest integer UZS (round half up). */
export function toUzs(value: number): number {
  return Math.round(value);
}

/** Multiply integer UZS unit price by a (possibly decimal) quantity, returning integer UZS. */
export function lineTotalUzs(unitPrice: number, quantity: number): number {
  if (!Number.isInteger(unitPrice)) {
    throw new Error(`unitPrice must be integer UZS, got ${unitPrice}`);
  }
  if (!(quantity > 0)) {
    throw new Error(`quantity must be positive, got ${quantity}`);
  }
  return toUzs(unitPrice * quantity);
}

export interface ServiceFeeResult {
  applies: boolean;
  amount: number;
  perPerson: number;
  method: ServiceFeeMethod;
}

/**
 * Compute the service fee for an order from the given configuration snapshot.
 * Pure function — the caller passes the config it loaded at order time, so
 * historical orders are never affected by later config changes.
 */
export function computeServiceFee(
  config: Pick<ServiceFeeConfigDto, 'enabled' | 'amountPerPerson' | 'applyToDineIn' | 'applyToDelivery' | 'method'>,
  orderType: OrderType,
  numberOfPeople: number,
): ServiceFeeResult {
  const perPerson = config.amountPerPerson;
  const method = config.method;
  if (!config.enabled) return { applies: false, amount: 0, perPerson, method };
  if (orderType === 'DINE_IN' && !config.applyToDineIn) return { applies: false, amount: 0, perPerson, method };
  if (orderType === 'DELIVERY' && !config.applyToDelivery) return { applies: false, amount: 0, perPerson, method };
  const people = Math.max(0, Math.floor(numberOfPeople));
  switch (method) {
    case ServiceFeeMethod.PER_PERSON:
    default:
      return { applies: people > 0 && perPerson > 0, amount: people * perPerson, perPerson, method };
  }
}

/** Format integer UZS with thousands separators, e.g. 45000 -> "45 000". */
export function formatUzs(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = String(Math.abs(Math.trunc(amount)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Format integer UZS with currency suffix, e.g. "45 000 so‘m". */
export function formatUzsCurrency(amount: number): string {
  return `${formatUzs(amount)} so‘m`;
}

/** Validate that a quantity string is a positive decimal with up to 3 decimal places. */
export function isValidQuantityString(q: string): boolean {
  return /^\d+(\.\d{1,3})?$/.test(q) && Number(q) > 0;
}
