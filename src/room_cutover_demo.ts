import { InfraiClient } from './infrai_client.ts';
import { processPaymentMatchmaking } from './room_cutover_service.ts';

async function main() {
  const infrai = new InfraiClient();

  const result = await processPaymentMatchmaking(infrai, {
    accountId: 'acct_demo_42',
    userId: 'user_7',
    username: 'maya',
    requestedStakeCents: 1500,
    balanceCents: 8000,
    paymentEventId: 'payevt_1001',
    paymentStatus: 'captured',
    chargebackCount30d: 0,
    region: 'us-east'
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
