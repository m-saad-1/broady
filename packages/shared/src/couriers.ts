/**
 * Courier configuration and utility functions
 * Supports: Leopards, TCS, Call Courier, Trax, and Others
 */

export type CourierName = 'Leopards' | 'TCS' | 'Call Courier' | 'Trax' | 'Other';

export interface CourierConfig {
  name: CourierName;
  displayName: string;
  trackingUrlPattern: (trackingNumber: string) => string;
  description: string;
}

export const COURIERS: Record<CourierName, CourierConfig> = {
  'Leopards': {
    name: 'Leopards',
    displayName: 'Leopards Courier',
    trackingUrlPattern: (trackingNumber) => 
      `https://track.leopardscourier.com/?track=${encodeURIComponent(trackingNumber)}`,
    description: 'Leopards Express Courier Service',
  },
  'TCS': {
    name: 'TCS',
    displayName: 'TCS Courier',
    trackingUrlPattern: (trackingNumber) => 
      `https://www.tcsexpress.com/Tracking/?cn=${encodeURIComponent(trackingNumber)}`,
    description: 'TCS Express Courier Service',
  },
  'Call Courier': {
    name: 'Call Courier',
    displayName: 'Call Courier',
    trackingUrlPattern: (trackingNumber) => 
      `https://www.callcourier.com.pk/tracking-system/?reference=${encodeURIComponent(trackingNumber)}`,
    description: 'Call Courier Service',
  },
  'Trax': {
    name: 'Trax',
    displayName: 'Trax Courier',
    trackingUrlPattern: (trackingNumber) => 
      `https://www.traxpk.com/Tracking/?cn=${encodeURIComponent(trackingNumber)}`,
    description: 'Trax Express Courier Service',
  },
  'Other': {
    name: 'Other',
    displayName: 'Other Courier',
    trackingUrlPattern: (trackingNumber) => 
      `${trackingNumber}`, // For custom couriers, just return the tracking number
    description: 'Custom/Other Courier Service',
  },
};

/**
 * Get all available courier names
 */
export function getAvailableCouriers(): CourierName[] {
  return Object.keys(COURIERS) as CourierName[];
}

/**
 * Get courier configuration by name
 */
export function getCourierConfig(name: string): CourierConfig | null {
  const normalizedName = Object.keys(COURIERS).find(
    key => key.toLowerCase() === name.toLowerCase()
  );
  return normalizedName ? COURIERS[normalizedName as CourierName] : null;
}

/**
 * Generate tracking URL for a courier and tracking number
 */
export function getTrackingUrl(courierName: string, trackingNumber: string): string | null {
  const config = getCourierConfig(courierName);
  if (!config) return null;
  return config.trackingUrlPattern(trackingNumber);
}

/**
 * Validate if a courier name is valid
 */
export function isValidCourierName(name: string): name is CourierName {
  return Object.keys(COURIERS).some(
    key => key.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Format courier name for display
 */
export function formatCourierName(name: string): string {
  const config = getCourierConfig(name);
  return config ? config.displayName : name;
}
