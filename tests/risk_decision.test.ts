import test from 'node:test';
import assert from 'node:assert/strict';
import { choosePaymentRoom } from '../src/payment_room_policy.ts';

test('captured payment with funds available is matched into a room', () => {
  const result = choosePaymentRoom({
    accountId: 'acct_1',
    userId: 'user_1',
    username: 'ada',
    requestedStakeCents: 2000,
    balanceCents: 5000,
    paymentEventId: 'evt_1',
    paymentStatus: 'captured',
    chargebackCount30d: 0,
    region: 'us-east'
  });

  assert.equal(result.approved, true);
  assert.equal(result.roomName, 'finmatch-us-east-micro');
  assert.equal(result.requiresManualReview, false);
  assert.equal(result.channelName, 'account-acct_1-audit');
});

test('pending payment is held for manual review and never gets a room', () => {
  const result = choosePaymentRoom({
    accountId: 'acct_9',
    userId: 'user_9',
    username: 'kai',
    requestedStakeCents: 4000,
    balanceCents: 9000,
    paymentEventId: 'evt_9',
    paymentStatus: 'pending',
    chargebackCount30d: 0,
    region: 'eu-west'
  });

  assert.equal(result.approved, false);
  assert.equal(result.roomName, null);
  assert.equal(result.reason, 'manual-review');
  assert.equal(result.riskTier, 'review');
});
