const fs = require('fs');
let content = fs.readFileSync('apps/api/src/modules/orders/orders.routes.ts', 'utf8');

// 1. Change the REQUEST branch condition back to ONLY cancellationMode === "REQUEST"
content = content.replace('if (cancellationMode === "REQUEST" || (payload.data.orderItemIds && payload.data.orderItemIds.length > 0)) {', 'if (cancellationMode === "REQUEST") {');

// 2. Rewrite the DIRECT cancellation block to handle partial cancellations
const directBlockRegex = /const canceled = await prisma\.\\(async \(tx\) => \{[\s\S]*?if \(targetSubOrder\.status !== OrderStatus\.CANCELED\) \{[\s\S]*?await createRefundRecord\(tx, \{[\s\S]*?note: "Auto-created after customer cancellation\.",\s*\}\);\s*\}\s*\}\s*\}/;

const newDirectBlock = \const canceled = await prisma.\(async (tx) => {
    if (targetSubOrder.status !== OrderStatus.CANCELED) {
      const isPartial = payload.data.orderItemIds && payload.data.orderItemIds.length > 0 && payload.data.orderItemIds.length < targetSubOrder.items.length;
      const cancelledItemIds = isPartial ? payload.data.orderItemIds : targetSubOrder.items.map(i => i.id);
      const itemsToCancel = targetSubOrder.items.filter(i => cancelledItemIds.includes(i.id));

      if (!isPartial) {
        await tx.subOrder.update({
          where: { id: targetSubOrder.id },
          data: { status: OrderStatus.CANCELED },
        });
      }

      await restockOrderItems(
        tx,
        itemsToCancel.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      );

      await tx.subOrderStatusLog.create({
        data: {
          subOrderId: targetSubOrder.id,
          status: isPartial ? targetSubOrder.status : OrderStatus.CANCELED,
          updatedBy: "USER",
          updatedById: req.auth!.userId,
          note: isPartial
            ? \\\CANCELLED_ITEMS:\ | Partial item cancellation by customer: \\\\
            : composeStatusNote(cancellationReason || "Vendor group cancelled by customer"),
        },
      });

      if (!isPartial) {
        await writeStatusHistory(tx, {
          subOrderId: targetSubOrder.id,
          oldStatus: targetSubOrder.status,
          newStatus: OrderStatus.CANCELED,
          changedByRole: "USER",
          changedById: req.auth!.userId,
          reason: mapCustomerCancellationReasonCode(payload.data.reasonCode),
          note: cancellationReason || "Vendor group cancelled by customer",
        });
      }

      if (shouldCreateRefundForPayment(order.paymentMethod)) {
        const refund = calculateRefundItems(itemsToCancel);
        if (refund.amountPkr > 0) {
          await createRefundRecord(tx, {
            orderId: order.id,
            subOrderId: targetSubOrder.id,
            requestedByRole: "USER",
            requestedById: req.auth!.userId,
            reasonCode: "CUSTOMER_CANCELLATION",
            reasonText: cancellationReason,
            method: getRefundMethodForPayment(order.paymentMethod),
            amountPkr: refund.amountPkr,
            items: refund.refundItems,
            note: "Auto-created after customer cancellation.",
          });
        }
      }
    }\;

content = content.replace(directBlockRegex, newDirectBlock);
fs.writeFileSync('apps/api/src/modules/orders/orders.routes.ts', content);
