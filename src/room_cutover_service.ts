import { InfraiClient } from './infrai_client.ts';
import { paymentMatchRequestSchema, type PaymentMatchRequest } from './matchmaking_requests.ts';
import { choosePaymentRoom, type MatchInput } from './payment_room_policy.ts';

export type CutoverResult = {
  decision: ReturnType<typeof choosePaymentRoom>;
  auditChannel: string;
  roomTokenIssued: boolean;
  realtimeTokenIssued: boolean;
};

export async function processPaymentMatchmaking(
  infrai: InfraiClient,
  payload: PaymentMatchRequest
): Promise<CutoverResult> {
  const input = paymentMatchRequestSchema.parse(payload) as MatchInput;
  const decision = choosePaymentRoom(input);

  await infrai.realtime.channel.create({
    channel: decision.channelName,
    type: 'private',
    vendor: 'infrai'
  });

  await infrai.realtime.publish({
    channel: decision.channelName,
    event: 'payment.matchmaking.audit.logged',
    account_id: input.accountId,
    idempotency_key: `audit-${input.paymentEventId}`,
    data: {
      payment_event_id: input.paymentEventId,
      user_id: input.userId,
      requested_stake_cents: input.requestedStakeCents,
      balance_cents: input.balanceCents,
      risk_tier: decision.riskTier,
      reason: decision.reason,
      approved: decision.approved
    }
  });

  let roomTokenIssued = false;
  if (decision.roomName) {
    await infrai.rtc.room.create({
      name: decision.roomName,
      max_participants: 2,
      empty_timeout_s: 120,
      region: input.region
    });

    await infrai.rtc.token.issue({
      room: decision.roomName,
      identity: input.userId,
      display_name: input.username,
      ttl_s: 1800,
      can_publish: true,
      can_subscribe: true
    });
    roomTokenIssued = true;
  }

  await infrai.realtime.token.issue({
    client_id: input.userId,
    channels: [decision.channelName],
    capabilities: ['subscribe'],
    ttl_seconds: 1800
  });

  await infrai.realtime.publish({
    channel: decision.channelName,
    event: 'payment.matchmaking.state.changed',
    account_id: input.accountId,
    idempotency_key: `state-${input.paymentEventId}`,
    data: {
      payment_event_id: input.paymentEventId,
      room_name: decision.roomName ?? 'manual-review',
      requires_manual_review: decision.requiresManualReview,
      notification_scope: 'audit'
    }
  });

  return {
    decision,
    auditChannel: decision.channelName,
    roomTokenIssued,
    realtimeTokenIssued: true
  };
}
