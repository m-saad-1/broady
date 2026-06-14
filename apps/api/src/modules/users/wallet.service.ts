import { Prisma, WalletTransactionSource, WalletTransactionType } from "@prisma/client";

export async function getOrCreateWallet(tx: Prisma.TransactionClient, userId: string) {
  const existing = await tx.userWallet.findUnique({
    where: { userId },
  });

  if (existing) return existing;

  return tx.userWallet.create({
    data: { userId },
  });
}

export async function creditWallet(tx: Prisma.TransactionClient, input: {
  userId: string;
  amountPkr: number;
  sourceType: WalletTransactionSource;
  note?: string | null;
  orderId?: string | null;
  refundRequestId?: string | null;
  paymentTransactionId?: string | null;
}) {
  if (input.amountPkr <= 0) {
    throw new Error("INVALID_WALLET_AMOUNT");
  }

  if (input.refundRequestId) {
    const existingRefundCredit = await tx.walletTransaction.findUnique({
      where: { refundRequestId: input.refundRequestId },
    });

    if (existingRefundCredit) {
      return existingRefundCredit;
    }
  }

  const wallet = await getOrCreateWallet(tx, input.userId);
  const nextBalance = wallet.availableBalancePkr + input.amountPkr;

  await tx.userWallet.update({
    where: { id: wallet.id },
    data: {
      availableBalancePkr: nextBalance,
      totalCreditedPkr: { increment: input.amountPkr },
    },
  });

  return tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      userId: input.userId,
      type: WalletTransactionType.CREDIT,
      sourceType: input.sourceType,
      amountPkr: input.amountPkr,
      balanceAfterPkr: nextBalance,
      note: input.note ?? null,
      orderId: input.orderId ?? null,
      refundRequestId: input.refundRequestId ?? null,
      paymentTransactionId: input.paymentTransactionId ?? null,
    },
  });
}
