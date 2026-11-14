export type RiskTier = 'low' | 'review';

export type MatchInput = {
  accountId: string;
  userId: string;
  username: string;
  requestedStakeCents: number;
  balanceCents: number;
  paymentEventId: string;
  paymentStatus: 'captured' | 'pending';
  chargebackCount30d: number;
  region: string;
};

export type RoomDecision = {
  approved: boolean;
  riskTier: RiskTier;
  reason: string;
  roomName: string | null;
  channelName: string;
  requiresManualReview: boolean;
};

export function choosePaymentRoom(input: MatchInput): RoomDecision {
  const reviewForPending = input.paymentStatus !== 'captured';
  const reviewForChargebacks = input.chargebackCount30d > 0;
  const reviewForBalance = input.balanceCents < input.requestedStakeCents;

  const requiresManualReview = reviewForPending || reviewForChargebacks || reviewForBalance;
  const riskTier: RiskTier = requiresManualReview ? 'review' : 'low';
  const bucket = input.requestedStakeCents <= 2500 ? 'micro' : 'standard';
  const roomName = requiresManualReview ? null : `finmatch-${input.region}-${bucket}`;

  return {
    approved: !requiresManualReview,
    riskTier,
    reason: requiresManualReview ? 'manual-review' : 'matched',
    roomName,
    channelName: `account-${input.accountId}-audit`,
    requiresManualReview
  };
}
