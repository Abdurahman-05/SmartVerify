import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bearer, createTestApp, registerOwner, resetDatabase, type TestApp } from './helpers.js';

let app: TestApp;

beforeAll(async () => {
  app = await createTestApp();
});
afterAll(async () => {
  await app.close();
});
beforeEach(async () => {
  await resetDatabase(app);
});

async function businessWithAccount() {
  const owner = await registerOwner(app);
  const account = (
    await app.inject({
      method: 'POST',
      url: '/api/v1/bank-accounts',
      headers: bearer(owner.token),
      payload: { bankCode: 'CBE', accountNumber: '1000293884582' },
    })
  ).json();
  const member = await app.prisma.businessMember.findFirstOrThrow({
    where: { userId: owner.userId },
  });
  return { businessId: member.businessId, memberId: member.id, accountId: account.id as string };
}

describe('database constraints', () => {
  it('a bank reference can be verified only once per business', async () => {
    const { businessId, accountId } = await businessWithAccount();
    const row = {
      businessId,
      bankAccountId: accountId,
      bankCode: 'CBE',
      reference: 'FT-ONCE',
      payerName: 'Customer',
      expectedAmount: 500,
      receivedAmount: 500,
      status: 'verified' as const,
    };
    await app.prisma.transaction.create({ data: row });
    await expect(app.prisma.transaction.create({ data: row })).rejects.toThrow();
    // Non-verified rows with the same reference are allowed (history of failed attempts).
    await expect(
      app.prisma.transaction.create({ data: { ...row, status: 'duplicate' } })
    ).resolves.toBeTruthy();
  });

  it('bill total must equal food + packing + delivery, and money cannot be negative', async () => {
    const { businessId, memberId } = await businessWithAccount();
    const order = await app.prisma.order.create({
      data: { businessId, number: 1001, type: 'takeaway', waiterId: memberId, foodTotalEtb: 530 },
    });
    const bill = {
      businessId,
      orderId: order.id,
      orderNo: 1001,
      type: 'takeaway' as const,
      foodTotalEtb: 530,
      packingFeeEtb: 30,
      deliveryFeeEtb: 0,
      waiterId: memberId,
    };
    await expect(app.prisma.bill.create({ data: { ...bill, totalEtb: 999 } })).rejects.toThrow();
    await expect(
      app.prisma.bill.create({ data: { ...bill, packingFeeEtb: -30, totalEtb: 500 } })
    ).rejects.toThrow();
    await expect(
      app.prisma.bill.create({ data: { ...bill, totalEtb: 560 } })
    ).resolves.toBeTruthy();
  });

  it('order numbers are unique per business', async () => {
    const { businessId, memberId } = await businessWithAccount();
    const order = {
      businessId,
      number: 1001,
      type: 'dine' as const,
      waiterId: memberId,
      foodTotalEtb: 100,
    };
    await app.prisma.order.create({ data: order });
    await expect(app.prisma.order.create({ data: order })).rejects.toThrow();
  });

  it('removing a bank account keeps its transactions (no cascade delete)', async () => {
    const { businessId, accountId } = await businessWithAccount();
    await app.prisma.transaction.create({
      data: {
        businessId,
        bankAccountId: accountId,
        bankCode: 'CBE',
        reference: 'FT-KEEP',
        payerName: 'Customer',
        expectedAmount: 100,
        receivedAmount: 100,
        status: 'verified',
      },
    });
    await expect(app.prisma.bankAccount.delete({ where: { id: accountId } })).rejects.toThrow();
  });
});
