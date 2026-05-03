-- Add DeliveryFailureReason enum for tracking delivery failure root causes
-- This supports the Delivery Failed Flow implementation

-- Create the enum
CREATE TYPE "DeliveryFailureReason" AS ENUM (
  'CUSTOMER_NOT_AVAILABLE',
  'INCORRECT_ADDRESS',
  'PHONE_UNREACHABLE',
  'REFUSED_DELIVERY',
  'AREA_NOT_SERVICEABLE',
  'OTHER'
);

-- The enum is now available for use in SubOrder and other models
-- The Prisma schema has already been updated to include this enum type
-- No table structure changes needed as failureReason is already defined as String?
