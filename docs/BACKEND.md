# Smart Verify — Frontend handoff for the backend team

This document describes what the mobile app (React Native + Expo) already does, the data it needs, and the
API the backend must provide. Today every server call is faked in `src/lib/mock/*.ts`. Each mock function is a
placeholder for one endpoint: replace its body with an HTTP call and keep the same input/output shapes, and the
screens keep working.

---

## 1. Product in one minute

Smart Verify lets Ethiopian businesses confirm that a customer's bank or Telebirr payment really arrived before
handing over goods.

| Plan | Price | What it includes |
|---|---|---|
| **Normal Verify** (`normal`) | 700 ETB / 1 month, 1,500 ETB / 3 months | Verify payment (amount + scan payment QR), transactions history, reports by bank, receiving bank accounts, subscription |
| **Restaurant Plus** (`restaurant`) | 4,000 ETB / month | Everything above + new orders (dine in / takeaway / delivery), open bills per table, bank / cash / cash+bank payments, automatic waiter tips, kitchen (chef) screen, staff accounts |

A business can also sign up and **explore** with no plan (`plan = null`).

**Roles** after sign-in: `owner`, `manager`, `waiter`, `chef`.

- `owner` creates the account (Create Account) and owns the plan.
- Staff (`manager`, `waiter`, `chef`) are added by the owner/manager and **share the owner's business and plan**.
- `chef` only sees the kitchen screen (no tabs).
- Only `owner` and `manager` can manage staff; only the `owner` can add a manager.

---

## 2. Conventions the frontend relies on

| Topic | Rule |
|---|---|
| Money | **Integer ETB** everywhere (no cents, no floats). `1000` means 1,000 ETB. |
| Phone | Stored as **9 digits without the country code**, starting with `9` or `7` (e.g. `"912345678"`). The UI shows `+251 912 345 678`. Delivery/takeaway customer phones are 10 digits starting `09`/`07`. |
| PIN | Owner: 6 digits (chosen at Create Account). Staff: 4 digits (temporary PIN set by owner/manager). Sign-in accepts 4–6 digits. **Hash it server-side.** |
| IDs | Opaque strings. The app never parses them. |
| Dates | ISO 8601 strings in UTC (`"2026-10-04T10:42:00.000Z"`). The app formats them locally. |
| Text / language | The app is bilingual (English + Amharic) and translates **on the device**. The API should return **codes, not sentences** (e.g. `status: "mismatch"`, `reason: "nameMismatch"`), plus raw names (people, banks, menu items). |
| Errors | Return a machine-readable `code` (e.g. `WRONG_CREDENTIALS`, `ACCOUNT_DUPLICATE`, `ACCOUNT_LIMIT`). The app maps codes to translated messages. |
| Auth | Not implemented yet. Suggested: sign-in returns a token; every other call sends `Authorization: Bearer <token>`; the server derives business + role from the token. |

---

## 3. Data models (as the app uses them today)

These are the TypeScript shapes in the code. Field names can change, but the information must be available.

### 3.1 Session / accounts

```ts
type Plan = 'normal' | 'restaurant';
type Role = 'owner' | 'manager' | 'waiter' | 'chef';
type BillingPeriod = 'monthly' | 'quarterly';

interface Subscription {
  plan: Plan;
  period: BillingPeriod;   // restaurant is always 'monthly'
  priceEtb: number;
  startedAt: string;
  endsAt: string;
}

// Returned by sign-in / create account. Staff get the owner's plan + subscription + businessName.
interface SessionUser {
  userId: string;
  displayName: string;
  businessName: string;
  phone?: string;          // 9 digits
  role: Role;
  plan: Plan | null;       // null = exploring, no plan yet
  subscription: Subscription | null;
}

interface Staff {          // src/features/staff/types.ts
  id: string;
  name: string;
  phone: string;           // 9 digits, unique across the business (and the owner)
  pin: string;             // 4 digits — never return this from the API
  role: 'manager' | 'waiter' | 'chef';
  canChangeDeliveryFee: boolean;
  canSeeReports: boolean;
  active: boolean;         // inactive staff cannot sign in
}
```

### 3.2 Bank accounts (receiving accounts)

```ts
interface Bank { code: string; name: string; shortName: string }   // e.g. CBE, TEL (Telebirr), AWA, DAS, BOA…

interface BankAccount {
  id: string;
  bankCode: string;        // badge text in the UI, e.g. "CBE"
  bankName: string;        // "Commercial Bank of Ethiopia"
  shortName: string;       // "CBE", "Telebirr", "Awash"
  last4: string;           // the app only ever shows the last 4 digits
  holderName: string;      // filled by the backend from the bank if the user leaves it empty
}
// Add input: { bankCode, accountNumber (10–13 digits), holderName? }
// Max 6 connected accounts per business. Removing an account keeps its past transactions.
```

### 3.3 Payment verification (both plans)

```ts
type TransactionStatus = 'verified' | 'pending' | 'mismatch' | 'duplicate';

interface Transaction {          // one verification attempt, shown in History and Reports
  id: string;
  accountId: string;             // receiving bank account
  payerName: string;
  reference: string;             // bank reference, e.g. "FT1234567890" / "CBE-9823412"
  expectedAmount: number;        // what the business asked for
  receivedAmount: number;        // what the bank says arrived
  status: TransactionStatus;
  createdAt: string;
}

// Result of "verify this QR for this amount into this account"
type VerificationResult =
  | { status: 'verified'; amount: number; accountName: string; reference: string; verifiedAt: string }
  | { status: 'failed'; reason: 'nameMismatch';   registeredName: string; payerName: string; reference: string }
  | { status: 'failed'; reason: 'amountMismatch'; expectedAmount: number; paidAmount: number; reference: string }
  | { status: 'failed'; reason: 'duplicate';      reference: string; firstVerifiedAt: string };
```

### 3.4 Restaurant Plus

```ts
type MenuCategory = 'food' | 'drinks' | 'combos';
interface MenuItem { id: string; name: string; priceEtb: number; category: MenuCategory }

type TableArea = 'main' | 'upstairs' | 'outside';
interface Table { id: string; number: number; area: TableArea; busy: boolean }   // busy = has an open dine-in bill

interface DeliveryArea { id: string; name: string; usualFeeEtb: number }          // e.g. Bole 80

type OrderNote = 'noOnion' | 'lessSpicy' | 'rush' | 'takeaway';                   // codes, translated in the app
interface OrderLine { itemId: string; name: string; priceEtb: number; quantity: number }

type OrderTarget =
  | { type: 'dineIn'; tableId: string; tableNumber: number; area: TableArea }
  | { type: 'takeaway'; customerName: string; customerPhone?: string }
  | { type: 'delivery'; areaName: string; deliveryFeeEtb: number; usualFeeEtb: number; address: string; customerPhone: string };

interface Order {
  id: string;
  number: number;                // human order number, e.g. #1043 (per business, increasing)
  target: OrderTarget;
  lines: OrderLine[];
  notes: OrderNote[];
  waiterId: string;
  waiterName: string;
  foodTotalEtb: number;
  createdAt: string;
}

interface Bill {                 // created automatically when an order is sent
  id: string;
  orderNo: number;
  type: 'dine' | 'takeaway' | 'delivery';
  tableNo?: number; tableArea?: TableArea; guests?: number;
  customerName?: string; phone?: string; area?: string; address?: string;
  items: OrderLine[];
  foodTotal: number;
  packingFee: number;            // takeaway + delivery only
  deliveryFee: number;           // delivery only
  total: number;                 // foodTotal + packingFee + deliveryFee
  waiterId: string; waiterName: string;
  status: 'open' | 'paid';
  servedStatus: 'kitchen' | 'served';
  createdAt: string;
}

interface Payment {              // one settled bill
  id: string;
  billId: string;
  method: 'bank' | 'cash+bank' | 'cash';
  cash: number;
  bank: number;                  // total bank money received (may be over several scans)
  tip: number;                   // extra money kept as the waiter's tip
  waiterId: string; waiterName: string;
  createdAt: string;
}

interface Tip {
  id: string;
  billId: string;
  label: string;                 // "Table 12" / "Takeaway #1044" — better: send bill info and let the app label it
  amount: number;
  source: 'bank' | 'cash';
  waiterId: string;
  createdAt: string;
  paidOut: false;                // payout to waiters not built yet
}

interface KitchenOrder {         // what the chef sees
  id: string;
  billId: string;
  orderNo: number;
  label: string;                 // same note as Tip.label
  type: 'dine' | 'takeaway' | 'delivery';
  waiterName: string;
  guests?: number; area?: string; customerName?: string;
  items: { qty: number; name: string }[];
  notes: string[];               // OrderNote codes
  status: 'new' | 'cooking' | 'ready';
  createdAt: string;
  startedAt?: string;            // when the chef pressed "Start cooking"
}
```

---

## 4. Endpoints the app needs

Each row maps a mock function to a suggested REST endpoint. All money is integer ETB. "Who" = roles allowed.

### 4.1 Auth & account — `src/lib/mock/auth.ts`, `staff.ts`, `subscription.ts`

| Mock function | Suggested endpoint | Who | Request | Response / errors |
|---|---|---|---|---|
| `signIn` | `POST /auth/sign-in` | anyone | `{ phone, pin, rememberMe }` | `SessionUser` (+ token). Checks the owner first, then **active** staff. Error `WRONG_CREDENTIALS`. |
| `createAccount` | `POST /auth/register` | anyone | `{ fullName, businessName, phone, pin }` (6-digit PIN) | `SessionUser` with `role: 'owner'`, `plan: null`. Error `PHONE_TAKEN`. |
| — (not built) | `POST /auth/forgot-pin` | anyone | `{ phone }` | Sign-in screen has a "Forgot PIN?" link with no flow yet. |
| — (not built) | `POST /auth/sign-out` | all | — | App only clears local state today. |
| `startSubscription` | `POST /subscription` | owner | `{ plan, period }` | `Subscription`. **No payment step yet** — the plan starts immediately. Staff must see the new plan on their next sign-in. |
| (choose plan "Explore") | `PATCH /business/plan` | owner | `{ plan }` | Sets the plan the owner is exploring without paying. |
| `getStaff` | `GET /staff` | owner, manager | — | `Staff[]` (never include `pin`). |
| store `addStaff` | `POST /staff` | owner, manager | `{ name, phone, pin, role, canChangeDeliveryFee, canSeeReports }` | `Staff`. Manager may only create `waiter`/`chef`. Phone must be unique (staff + owner): `PHONE_TAKEN`. |
| store `setActive` | `PATCH /staff/:id` | owner, manager | `{ active }` | `Staff`. A user cannot deactivate themselves; only the owner can change a manager. |

### 4.2 Bank accounts — `src/lib/mock/bankAccounts.ts`

| Mock function | Suggested endpoint | Who | Request | Response / errors |
|---|---|---|---|---|
| `banks` (constant) | `GET /banks` | all | — | `Bank[]` supported banks + Telebirr. The list in the app is a guess; please send the real one. |
| `getBankAccounts` | `GET /bank-accounts` | all | — | Connected `BankAccount[]`. |
| `addBankAccount` | `POST /bank-accounts` | owner, manager | `{ bankCode, accountNumber, holderName? }` | `BankAccount`. Look up the holder name at the bank when empty. Errors `ACCOUNT_DUPLICATE`, `ACCOUNT_LIMIT` (max 6). |
| `removeBankAccount` | `DELETE /bank-accounts/:id` | owner, manager | — | Soft delete: old transactions must still resolve the bank name. |

### 4.3 Verify payment (both plans) — `src/lib/mock/verify.ts`, `transactions.ts`, `home.ts`

| Mock function | Suggested endpoint | Who | Request | Response / errors |
|---|---|---|---|---|
| `verifyPayment` | `POST /verifications` | all except chef | `{ accountId, amount, qrData }` (`qrData` = raw text of the customer's payment QR) | `VerificationResult`. Must also **store a Transaction** (verified / mismatch / duplicate). Bank unreachable → error so the app shows "Try again". |
| `checkBankPayment` | `POST /verifications/bank-check` | all except chef | `{ accountId, expected, qrData }` | `{ received, reference }` — how much actually arrived. Used by the restaurant flow; the app decides paid / short / over itself (see §5). |
| `getTransactions` | `GET /transactions?period=today\|7d\|30d&accountId=&status=` | all except chef | query | `Transaction[]`, newest first. `period` is the business's local day boundaries. |
| `getTransaction` | `GET /transactions/:id` | all except chef | — | `Transaction`. |
| `getBankReport` | `GET /reports/by-bank?period=` | owner, manager, waiters with `canSeeReports` | query | `{ total, count, rows: { account, count, total, share }[] }` — **only `verified` transactions count as money**. Include removed accounts that received money in the period. |
| `getTodaySummary` | `GET /summary/today` | all except chef | — | `{ verified, pending, duplicate }` counts for the Home "Today" card. |
| (PDF / CSV export) | — | — | — | Built **on the device** from the lists above. No endpoint needed unless you prefer server-side statements. |

### 4.4 Restaurant Plus — `restaurant.ts`, `bills.ts`, `payments.ts`, `tips.ts`, `kitchen.ts`, `fees.ts`

| Mock function | Suggested endpoint | Who | Request | Response / errors |
|---|---|---|---|---|
| `getMenu` | `GET /menu` | owner, manager, waiter | — | `MenuItem[]`. Menu editing (admin "Menu" design) is not built yet. |
| `getTables` | `GET /tables` | owner, manager, waiter | — | `Table[]` with `busy` = an open dine-in bill exists. |
| `deliveryAreas` + `fees.ts` | `GET /fees` | owner, manager, waiter | — | `{ packingFeeEtb: 30, deliveryAreas: DeliveryArea[] }`. Fee settings screen not built yet. |
| `sendOrder` | `POST /orders` | owner, manager, waiter | `{ target, lines, notes }` (waiter from token) | `Order`. **In the same transaction** create the `Bill` and the `KitchenOrder` (see §5). The waiter can override the delivery fee; keep `usualFeeEtb` and who changed it (design: "Changed from usual 80 ETB · Dawit G."). |
| `getOrder` | `GET /orders/:id` | owner, manager, waiter | — | `Order` (for the "Sent to the kitchen" screen). |
| `getBills` | `GET /bills?status=open&mine=true\|false` | owner, manager, waiter | query | `Bill[]` oldest first. "My tables" = `waiterId` is the caller. |
| `getBill` | `GET /bills/:id` | owner, manager, waiter | — | `Bill`. |
| — (not built) | `POST /bills/:id/items` | owner, manager, waiter | `{ lines }` | "Add more items" to an open bill — button exists, disabled. |
| bank / cash+bank settle (`settlePayment` in `features/verify/restaurantFlow.ts`) | `POST /bills/:id/payments` | owner, manager, waiter | `{ method: 'bank'\|'cash+bank', cash, accountId, received }` | Server re-runs the calculation (§5), marks the bill `paid` when paid/over, creates `Payment` and `Tip`. On **short**, keeps the bill open and returns `remaining`; the next scan adds to the bank total. |
| cash only (`CashPaymentScreen`) | `POST /bills/:id/payments` | owner, manager, waiter | `{ method: 'cash', cash, extraChoice: 'tip'\|'giveback' }` | Requires `cash >= total`. Marks paid, creates `Payment` (+ `Tip` if extraChoice = tip). "Recorded by" = caller. |
| `createPayment` / `getPayments` | `GET /payments?period=` | owner, manager | — | For a future daily cash ledger. |
| `getTips` | `GET /tips?period=today\|7d\|30d&mine=true` | waiter (own), owner/manager (all) | query | `Tip[]` newest first. |
| `getKitchenOrders` | `GET /kitchen/orders?status=new\|cooking\|ready` | chef (+ owner/manager) | query | `KitchenOrder[]` oldest first. |
| store `startCooking` | `POST /kitchen/orders/:id/start` | chef | — | Sets `status = 'cooking'`, `startedAt = now`. |
| store `markReady` | `POST /kitchen/orders/:id/ready` | chef | — | Sets `status = 'ready'` **and the bill's `servedStatus = 'served'`**. |

---

## 5. Business rules (please enforce on the server too)

**Bill total** — `total = foodTotal + packingFee + deliveryFee`. Packing (30 ETB today) applies to takeaway and
delivery; delivery fee only to delivery. Dine-in has neither.

**Bank / cash+bank payment** — `src/features/verify/calcPayment.ts` → `calcPayment({ total, cash, received })`:

```
expectedBank = total - cash            (bank only: cash = 0; cash must be < total)
received == expectedBank → paid
received >  expectedBank → over:  tip = received - expectedBank
received <  expectedBank → short: remaining = expectedBank - received   (bill stays open)
```

`received` is the **sum of all bank scans for this bill**: after a short payment the waiter scans again for the
remaining amount, or changes the cash amount.

**Cash only** — `calcCash({ total, cash, extraChoice })`: `cash < total` is invalid (`missing = total - cash`).
Extra money (`cash - total`) is either the waiter's tip (`extraChoice = 'tip'`, default) or change given back.

**Tips** — created whenever a payment has `tip > 0`, for the bill's waiter, with `source = 'cash'` for cash payments
and `'bank'` otherwise. **Tips are never part of sales/revenue** (reports, Home totals).

**Kitchen** — every sent order appears in the kitchen as `new`. Chef: `new → cooking → ready`. `ready` marks the
bill "Served". The app shows the waiting minutes (from `createdAt`, red after 10 min).

**Tables** — a table is busy while it has an open dine-in bill. Busy tables cannot be chosen for a new order.

**Verification statuses** — `verified` (exact match), `mismatch` (name or amount differs), `duplicate` (reference
already used before), `pending` (bank has not confirmed yet). Reports and History totals only count `verified`.

**Limits** — max 6 receiving bank accounts. Staff phone numbers unique within the business.

---

## 6. Live updates

These screens should refresh without pulling to refresh (WebSocket or short polling, ~15–30 s):

- Kitchen queue (new orders arriving).
- Open bills (served status, bills paid by another waiter).
- Home "Today" counts and "{n} tables waiting".

No push notifications or sounds are built yet.

---

## 7. Test data used by the mocks

| Who | Phone | PIN |
|---|---|---|
| Owner Abebe (Restaurant Plus) | 912345678 | 123456 |
| Waiter Dawit G. | 911111111 | 1111 |
| Waiter Selam T. | 922222222 | 2222 |
| Chef Hana M. | 933333333 | 3333 |
| Manager Yonas B. (inactive) | 944444444 | 4444 |

Seed bills: tables 12, 8, 3, 5. Seed kitchen orders: Table 12, Delivery #1043, Takeaway #1044.
Normal-plan mock verification: the last digit of the amount picks the result (1 = name mismatch, 2 = amount
mismatch, 3 = duplicate, else verified).

---

## 8. Open questions for backend / product

1. **QR format** — what exactly is inside a CBE / Telebirr / other bank payment QR, and which bank APIs confirm a payment and return payer name + amount + reference?
2. **PIN reset** — "Forgot PIN?" flow (SMS OTP?).
3. **Subscription payment** — no payment step yet; which provider (Telebirr, Chapa, …)?
4. **Real bank list** and account number rules per bank.
5. **Day boundaries** for "today" / reports — business timezone (Africa/Addis_Ababa assumed).
6. **Waiter tip payouts** (`paidOut`) and the daily cash ledger — not designed yet.
7. **Receipts** — "Share receipt" buttons are placeholders; decide format (image, PDF, SMS link).
8. **Support contact** — Help screen has placeholder text only.
9. **Admin screens not built yet:** Overview, Menu, Fees (designs exist in `docs/design/screens/Admin*.dc.html`).
10. **Restaurant verify in History** — restaurant bank checks currently create a Payment but not a Transaction row; decide whether they should appear in History/Reports.
