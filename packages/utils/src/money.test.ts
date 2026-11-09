import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderType, ServiceFeeMethod, type ServiceFeeConfigDto } from '@ikki-dost/shared-types';
import { computeServiceFee, formatUzs, isValidQuantityString, lineTotalUzs, toUzs } from './money.js';

const defaultConfig: Pick<ServiceFeeConfigDto, 'enabled' | 'amountPerPerson' | 'applyToDineIn' | 'applyToDelivery' | 'method'> = {
  enabled: true,
  amountPerPerson: 4000,
  applyToDineIn: true,
  applyToDelivery: true,
  method: ServiceFeeMethod.PER_PERSON,
};

test('toUzs rounds half up', () => {
  assert.equal(toUzs(100.4), 100);
  assert.equal(toUzs(100.5), 101);
});

test('lineTotalUzs: integer price x decimal quantity', () => {
  assert.equal(lineTotalUzs(45000, 0.75), 33750); // 0.750 kg oq baliq
  assert.equal(lineTotalUzs(70000, 1), 70000);
  assert.equal(lineTotalUzs(3000, 2), 6000);
  assert.throws(() => lineTotalUzs(100.5, 1));
  assert.throws(() => lineTotalUzs(100, 0));
});

test('service fee: dine-in 5 people = 20 000', () => {
  const r = computeServiceFee(defaultConfig, OrderType.DINE_IN, 5);
  assert.equal(r.applies, true);
  assert.equal(r.amount, 20000);
});

test('service fee: delivery 2 people = 8 000', () => {
  const r = computeServiceFee(defaultConfig, OrderType.DELIVERY, 2);
  assert.equal(r.amount, 8000);
});

test('service fee: disabled for delivery -> 0', () => {
  const r = computeServiceFee({ ...defaultConfig, applyToDelivery: false }, OrderType.DELIVERY, 2);
  assert.equal(r.applies, false);
  assert.equal(r.amount, 0);
  // dine-in still applies
  assert.equal(computeServiceFee({ ...defaultConfig, applyToDelivery: false }, OrderType.DINE_IN, 2).amount, 8000);
});

test('service fee: globally disabled -> 0', () => {
  assert.equal(computeServiceFee({ ...defaultConfig, enabled: false }, OrderType.DINE_IN, 10).amount, 0);
});

test('service fee: 0 people -> does not apply', () => {
  assert.equal(computeServiceFee(defaultConfig, OrderType.DINE_IN, 0).applies, false);
});

test('formatUzs', () => {
  assert.equal(formatUzs(45000), '45 000');
  assert.equal(formatUzs(2000), '2 000');
  assert.equal(formatUzs(-150000), '-150 000');
});

test('isValidQuantityString', () => {
  assert.equal(isValidQuantityString('0.750'), true);
  assert.equal(isValidQuantityString('1'), true);
  assert.equal(isValidQuantityString('2.5'), true);
  assert.equal(isValidQuantityString('0'), false);
  assert.equal(isValidQuantityString('1.2345'), false);
  assert.equal(isValidQuantityString('abc'), false);
});
