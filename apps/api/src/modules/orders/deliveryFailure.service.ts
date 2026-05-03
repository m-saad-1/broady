/**
 * Delivery failure reason keys and labels.
 * The keys are canonical and the labels are used for UI and notifications.
 */
export const DELIVERY_FAILURE_REASONS = {
  CUSTOMER_NOT_AVAILABLE: "Customer not available",
  INCORRECT_ADDRESS: "Incorrect address",
  PHONE_UNREACHABLE: "Phone unreachable",
  REFUSED_DELIVERY: "Refused delivery",
  AREA_NOT_SERVICEABLE: "Area not serviceable",
  OTHER: "Other",
} as const;

// Map frontend-specific keys to backend canonical keys
const FRONTEND_TO_BACKEND_REASON_MAP: Record<string, DeliveryFailureReasonKey> = {
  CUSTOMER_UNAVAILABLE: "CUSTOMER_NOT_AVAILABLE",
  REFUSED_BY_CUSTOMER: "REFUSED_DELIVERY",
  UNREACHABLE_LOCATION: "AREA_NOT_SERVICEABLE",
};

export type DeliveryFailureReasonKey = keyof typeof DELIVERY_FAILURE_REASONS;

export type DeliveryFailurePolicy = {
  reason: DeliveryFailureReasonKey;
  label: string;
  retryable: boolean;
  maxAttempts: number;
  retryDelayHours: number | null;
  requiresAddressCorrection: boolean;
};

export interface SuspiciousDeliveryPattern {
  brandId: string;
  suspiciousCount: number;
  failureRates: {
    reasonCode: DeliveryFailureReasonKey;
    count: number;
    percentage: number;
  }[];
  recentFailures: {
    orderId: string;
    reason: DeliveryFailureReasonKey;
    timestamp: Date;
  }[];
  isHighRisk: boolean;
  flags: string[];
}

export interface DeliveryFailureNotificationContext {
  failureReason: DeliveryFailureReasonKey;
  failureReasonMessage?: string | null;
  paymentMethod: "COD" | "JAZZCASH" | "EASYPAISA";
  deliveryAttempt: number;
  maxAttempts: number;
  nextAttemptDate: Date | null;
  isFinalFailure: boolean;
}

const DELIVERY_FAILURE_POLICY: Record<DeliveryFailureReasonKey, DeliveryFailurePolicy> = {
  CUSTOMER_NOT_AVAILABLE: {
    reason: "CUSTOMER_NOT_AVAILABLE",
    label: DELIVERY_FAILURE_REASONS.CUSTOMER_NOT_AVAILABLE,
    retryable: true,
    maxAttempts: 3,
    retryDelayHours: 12,
    requiresAddressCorrection: false,
  },
  INCORRECT_ADDRESS: {
    reason: "INCORRECT_ADDRESS",
    label: DELIVERY_FAILURE_REASONS.INCORRECT_ADDRESS,
    retryable: false,
    maxAttempts: 1,
    retryDelayHours: null,
    requiresAddressCorrection: true,
  },
  PHONE_UNREACHABLE: {
    reason: "PHONE_UNREACHABLE",
    label: DELIVERY_FAILURE_REASONS.PHONE_UNREACHABLE,
    retryable: true,
    maxAttempts: 3,
    retryDelayHours: 12,
    requiresAddressCorrection: false,
  },
  REFUSED_DELIVERY: {
    reason: "REFUSED_DELIVERY",
    label: DELIVERY_FAILURE_REASONS.REFUSED_DELIVERY,
    retryable: false,
    maxAttempts: 1,
    retryDelayHours: null,
    requiresAddressCorrection: false,
  },
  AREA_NOT_SERVICEABLE: {
    reason: "AREA_NOT_SERVICEABLE",
    label: DELIVERY_FAILURE_REASONS.AREA_NOT_SERVICEABLE,
    retryable: false,
    maxAttempts: 1,
    retryDelayHours: null,
    requiresAddressCorrection: false,
  },
  OTHER: {
    reason: "OTHER",
    label: DELIVERY_FAILURE_REASONS.OTHER,
    retryable: true,
    maxAttempts: 2,
    retryDelayHours: 18,
    requiresAddressCorrection: false,
  },
};

function normalizeToken(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function normalizeDeliveryFailureReasonInput(input?: string | null): DeliveryFailureReasonKey | null {
  if (!input) return null;

  const normalized = normalizeToken(input);
  
  if (normalized in DELIVERY_FAILURE_REASONS) {
    return normalized as DeliveryFailureReasonKey;
  }

  if (normalized in FRONTEND_TO_BACKEND_REASON_MAP) {
    return FRONTEND_TO_BACKEND_REASON_MAP[normalized];
  }

  const labelMatch = Object.entries(DELIVERY_FAILURE_REASONS).find(([, label]) => normalizeToken(label) === normalized);
  return (labelMatch?.[0] as DeliveryFailureReasonKey | undefined) ?? null;
}

export function getDeliveryFailurePolicy(reasonCode: DeliveryFailureReasonKey): DeliveryFailurePolicy {
  return DELIVERY_FAILURE_POLICY[reasonCode];
}

export function getRetryDelayHours(reasonCode: DeliveryFailureReasonKey): number | null {
  return getDeliveryFailurePolicy(reasonCode).retryDelayHours;
}

export function isRetryableFailure(reasonCode: DeliveryFailureReasonKey): boolean {
  return getDeliveryFailurePolicy(reasonCode).retryable;
}

export function shouldMoveTowardCancellation(reasonCode: DeliveryFailureReasonKey): boolean {
  return !getDeliveryFailurePolicy(reasonCode).retryable;
}

export function calculateNextAttemptDate(reasonCode: DeliveryFailureReasonKey, baseDate = new Date()): Date | null {
  const delayHours = getRetryDelayHours(reasonCode);
  if (delayHours === null) return null;

  const nextAttempt = new Date(baseDate);
  nextAttempt.setHours(nextAttempt.getHours() + delayHours);
  return nextAttempt;
}

function formatFailureReasonLabel(reasonCode: DeliveryFailureReasonKey, failureReasonMessage?: string | null) {
  const baseLabel = DELIVERY_FAILURE_REASONS[reasonCode];
  if (reasonCode !== "OTHER") {
    return baseLabel;
  }

  const customMessage = failureReasonMessage?.trim();
  return customMessage ? `${baseLabel}: ${customMessage}` : baseLabel;
}

export function detectSuspiciousFraudPatterns(
  brandId: string,
  failureHistory: Array<{ reason: DeliveryFailureReasonKey; createdAt: Date }>,
): SuspiciousDeliveryPattern {
  const flags: string[] = [];
  const recentCount = failureHistory.length;
  const suspiciousCount = Math.max(0, recentCount - 5);

  const reasonCounts = new Map<DeliveryFailureReasonKey, number>();
  for (const failure of failureHistory) {
    reasonCounts.set(failure.reason, (reasonCounts.get(failure.reason) || 0) + 1);
  }

  const failureRates = Array.from(reasonCounts.entries())
    .map(([reasonCode, count]) => ({
      reasonCode,
      count,
      percentage: recentCount > 0 ? Math.round((count / recentCount) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  if (recentCount > 10) {
    flags.push("EXCESSIVE_FAILURES");
  }

  const refusedDeliveryRate = failureRates.find((r) => r.reasonCode === "REFUSED_DELIVERY")?.percentage || 0;
  if (refusedDeliveryRate > 30) {
    flags.push("HIGH_REFUSAL_RATE");
  }

  const otherRate = failureRates.find((r) => r.reasonCode === "OTHER")?.percentage || 0;
  if (otherRate > 40) {
    flags.push("SUSPICIOUS_REASON_PATTERNS");
  }

  const areaNotServiceableRate = failureRates.find((r) => r.reasonCode === "AREA_NOT_SERVICEABLE")?.percentage || 0;
  if (areaNotServiceableRate > 50) {
    flags.push("SYSTEMATIC_AREA_EXCLUSION");
  }

  return {
    brandId,
    suspiciousCount,
    failureRates,
    recentFailures: failureHistory.slice(0, 5).map((failure, index) => ({
      orderId: `order_${index}`,
      reason: failure.reason,
      timestamp: failure.createdAt,
    })),
    isHighRisk: suspiciousCount > 3 || flags.length > 1,
    flags,
  };
}

export function buildCustomerFailureMessage(context: DeliveryFailureNotificationContext): string {
  const reasonLabel = formatFailureReasonLabel(context.failureReason, context.failureReasonMessage);
  const attemptInfo = `Attempt ${context.deliveryAttempt} of ${context.maxAttempts}`;

  if (context.isFinalFailure) {
    if (context.paymentMethod === "COD") {
      return `Delivery failed (${reasonLabel}). This COD order will be cancelled after ${attemptInfo}.`;
    }

    return `Delivery failed (${reasonLabel}). This prepaid order will be returned and refunded after ${attemptInfo}.`;
  }

  if (context.nextAttemptDate) {
    const d = context.nextAttemptDate;
    const retryDate = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
    return `Delivery failed (${reasonLabel}). Next attempt is scheduled for ${retryDate}. ${attemptInfo}.`;
  }

  if (context.failureReason === "INCORRECT_ADDRESS") {
    return `Delivery failed (${reasonLabel}). Please update the address before the order can be reattempted.`;
  }

  return `Delivery failed (${reasonLabel}). ${attemptInfo}.`;
}

export function buildBrandFailureMessage(context: DeliveryFailureNotificationContext): string {
  const reasonLabel = formatFailureReasonLabel(context.failureReason, context.failureReasonMessage);

  if (context.isFinalFailure) {
    const action = context.paymentMethod === "COD" ? "will be cancelled" : "will be returned and refunded";
    return `Final delivery attempt failed (${reasonLabel}). The order ${action}.`;
  }

  if (context.nextAttemptDate) {
    const d = context.nextAttemptDate;
    const retryDate = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
    return `Delivery attempt ${context.deliveryAttempt} failed (${reasonLabel}). Next retry is scheduled for ${retryDate}.`;
  }

  if (context.failureReason === "INCORRECT_ADDRESS") {
    return `Delivery failed (${reasonLabel}). Hold reattempts until the customer updates their address.`;
  }

  return `Delivery failed (${reasonLabel}). Attempt ${context.deliveryAttempt} of ${context.maxAttempts}.`;
}

export function isValidFailureReason(code: string): code is DeliveryFailureReasonKey {
  return normalizeDeliveryFailureReasonInput(code) !== null;
}

export function describeFailureReason(reasonCode: DeliveryFailureReasonKey, failureReasonMessage?: string | null) {
  return formatFailureReasonLabel(reasonCode, failureReasonMessage);
}
