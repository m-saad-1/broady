const fs = require('fs');
const p = 'apps/api/src/modules/brands/brand-dashboard.routes.ts';
let c = fs.readFileSync(p, 'utf8');

const regex = /const updated = await prisma\.\$transaction\(async \(tx\) => \{\s+const next = await tx\.cancellationRequest\.update\(\{\s+where: \{ id: request\.id \},\s+data: \{\s+brandResponseCode: payload\.data\.responseCode,\s+brandResponseNote: payload\.data\.note\?\.trim\(\) \|\| null,\s+trackingEvidence: payload\.data\.trackingEvidence\?\.trim\(\) \|\| null,\s+evidenceUrl: payload\.data\.evidenceUrl\?\.trim\(\) \|\| null,\s+respondedAt: new Date\(\),\s+\},\s+\}\);\s+await tx\.cancellationHistory\.create\(\{\s+data: \{\s+cancellationRequestId: request\.id,\s+action: "BRAND_RESPONDED",\s+performedByRole: "BRAND",\s+performedById: req\.auth!\.userId,\s+note: payload\.data\.note\?\.trim\(\) \|\| payload\.data\.responseCode,\s+\},\s+\}\);\s+return next;\s+\}\);/;

const rep = `const updated = await prisma.$transaction(async (tx) => {
    const isAutoApprove = payload.data.responseCode === "STILL_CANCELLABLE";

    const next = await tx.cancellationRequest.update({
      where: { id: request.id },
      data: {
        brandResponseCode: payload.data.responseCode,
        brandResponseNote: payload.data.note?.trim() || null,
        trackingEvidence: payload.data.trackingEvidence?.trim() || null,
        evidenceUrl: payload.data.evidenceUrl?.trim() || null,
        respondedAt: new Date(),
        ...(isAutoApprove ? { status: "APPROVED", decidedAt: new Date(), decisionNote: "Auto-approved by brand" } : {}),
      },
      include: { order: true, subOrder: true },
    });

    await tx.cancellationHistory.create({
      data: {
        cancellationRequestId: request.id,
        action: isAutoApprove ? "AUTO_APPROVED" : "BRAND_RESPONDED",
        performedByRole: "BRAND",
        performedById: req.auth!.userId,
        note: payload.data.note?.trim() || payload.data.responseCode,
      },
    });

    if (isAutoApprove) {
      await tx.subOrder.update({
        where: { id: request.subOrderId },
        data: { status: "CANCELED" },
      });

      if (next.order.paymentStatus === "PAID" && next.order.paymentMethod !== "COD") {
        await tx.refundRequest.create({
          data: {
            orderId: request.orderId,
            subOrderId: request.subOrderId,
            cancellationRequestId: request.id,
            requestedByRole: "SYSTEM",
            requestedById: req.auth!.userId,
            reasonCode: "ORDER_CANCELLED",
            method: "ORIGINAL_SOURCE",
            amountPkr: next.subOrder.subtotalPkr,
            status: "APPROVED",
          },
        });
      }
    }

    return next;
  });`;

if (regex.test(c)) {
  c = c.replace(regex, rep);
  fs.writeFileSync(p, c);
  console.log('replaced successfully');
} else {
  console.log('not found via regex');
}
