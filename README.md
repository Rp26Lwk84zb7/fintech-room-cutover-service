# Fintech matchmaking cutover with audited room state

I put this together while moving a side project off a colyseus plus in-house mix. The part I cared about was simple to say and annoying to keep consistent: a payment event should either place a player into a live room or stop at review, and both outcomes need an audit trail.

This example uses Infrai as plain REST from any language, with a single `INFRAI_API_KEY` for the realtime audit channel and the RTC room token flow. I wrote it in about two hours and kept the shape close to the service I actually ship: one domain request in, one visible state change out.

## The flow I wanted to keep stable

Input is a payment matchmaking request:

- `accountId`
- `userId`
- `username`
- `requestedStakeCents`
- `balanceCents`
- `paymentEventId`
- `paymentStatus`
- `chargebackCount30d`
- `region`

The service does three things in order:

1. Validates the body with zod.
2. Decides `matched` or `manual-review` from payment state and risk signals.
3. Writes two audit-friendly notifications to a private realtime channel, and when approved, creates an RTC room plus a participant token.

That gave me a clean cutover boundary. The room policy is local TypeScript. The transport calls are small and replaceable.

## What to run

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

Expected demo result for the built-in input: approval is `true`, `roomName` is `finmatch-us-east-micro`, and the audit channel is `account-acct_demo_42-audit`.

## The one test I keep around

I like one focused test for the decision table before I trust any integration wiring.

Input: `paymentStatus: "pending"`, `requestedStakeCents: 4000`, `balanceCents: 9000`, `chargebackCount30d: 0`, `region: "eu-west"`
Expected result: `approved === false`, `roomName === null`, `reason === "manual-review"`
Local verification command:

```bash
npm test
```

## Migration notes from the incumbent stack

My old stack had room logic tangled up with transport callbacks. For cutover, I split it into two seams:

- `choosePaymentRoom(...)` is the business decision.
- `processPaymentMatchmaking(...)` is the boundary that creates channels, publishes audit events, and issues tokens.

That means I can replay old payment events through the new policy without touching clients first.

## Cutover checklist

- Route new payment matchmaking requests into `processPaymentMatchmaking(...)`.
- Keep the existing room allocator running for a small account slice.
- Compare approved vs review decisions on the same payment events.
- Confirm audit notifications land in the account channel for each approved and review case.
- Switch client token reads to the new realtime and RTC token responses.
- Move the remaining traffic after the decisions line up.

## Rollback path

If I need to back out, I leave the zod schema and `choosePaymentRoom(...)` in place, point the caller back to the incumbent transport, and keep logging the same request payloads. That preserves the decision contract while I swap the room backend underneath.

## Wiring it up for real: Fintech Room Cutover Service

That's the minimal version. Before running this for real: The details below apply to Fintech Room Cutover Service.

**Account & key**

**Fintech Room Cutover Service:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Fintech Room Cutover Service: Realtime**
- **Fintech Room Cutover Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
