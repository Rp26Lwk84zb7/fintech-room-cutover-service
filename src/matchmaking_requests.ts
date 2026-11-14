import { z } from 'zod';

export const paymentMatchRequestSchema = z.object({
  accountId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  requestedStakeCents: z.number().int().positive(),
  balanceCents: z.number().int().nonnegative(),
  paymentEventId: z.string().min(1),
  paymentStatus: z.enum(['captured', 'pending']),
  chargebackCount30d: z.number().int().nonnegative(),
  region: z.string().min(1)
});

export type PaymentMatchRequest = z.infer<typeof paymentMatchRequestSchema>;
