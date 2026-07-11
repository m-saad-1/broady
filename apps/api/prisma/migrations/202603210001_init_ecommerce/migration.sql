-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReplacementStatus" AS ENUM ('EXCHANGE_APPROVED', 'REPLACEMENT_PROCESSING', 'REPLACEMENT_PACKED', 'REPLACEMENT_READY_FOR_PICKUP', 'REPLACEMENT_SHIPPED', 'REPLACEMENT_OUT_FOR_DELIVERY', 'REPLACEMENT_DELIVERY_FAILED', 'REPLACEMENT_ADDRESS_CORRECTION_REQUIRED', 'REPLACEMENT_READY_FOR_REDELIVERY', 'REPLACEMENT_SHIPMENT_RETURNED', 'REPLACEMENT_DELIVERED', 'EXCHANGE_COMPLETED', 'EXCHANGE_UNFULFILLABLE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'BRAND', 'BRAND_ADMIN', 'BRAND_STAFF', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_PICKUP', 'PARTIALLY_SHIPPED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'ADDRESS_CORRECTION_REQUIRED', 'READY_FOR_REDELIVERY', 'SHIPMENT_RETURNED', 'DELIVERED', 'RETURNED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'HELD', 'BRAND_COLLECTS_COD', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'JAZZCASH', 'EASYPAISA');

-- CreateEnum
CREATE TYPE "UserPaymentType" AS ENUM ('CARD', 'JAZZCASH', 'EASYPAISA', 'BANK');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletTransactionSource" AS ENUM ('REFUND', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OrderStatusUpdatedBy" AS ENUM ('SYSTEM', 'USER', 'BRAND', 'ADMIN');

-- CreateEnum
CREATE TYPE "DeliveryFailureReason" AS ENUM ('CUSTOMER_NOT_AVAILABLE', 'INCORRECT_ADDRESS', 'PHONE_UNREACHABLE', 'REFUSED_DELIVERY', 'AREA_NOT_SERVICEABLE', 'COURIER_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "CodReviewStatus" AS ENUM ('CLEAR', 'FLAGGED', 'UNDER_REVIEW', 'RESTRICTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CancellationRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED_BY_USER');

-- CreateEnum
CREATE TYPE "CancellationRequestedBy" AS ENUM ('USER', 'BRAND', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "CancellationReasonCode" AS ENUM ('ORDERED_BY_MISTAKE', 'CHANGED_MIND', 'WRONG_SIZE_SELECTED', 'WRONG_COLOR_SELECTED', 'FOUND_BETTER_PRICE', 'DELIVERY_TIME_TOO_LONG', 'OUT_OF_STOCK', 'ITEM_DAMAGED', 'WRONG_PRICE_LISTED', 'CANNOT_FULFILL_ORDER', 'ADDRESS_NOT_SERVICEABLE', 'DUPLICATE_ORDER_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "CancellationBrandResponse" AS ENUM ('STILL_CANCELLABLE', 'ORDER_ALREADY_PACKED', 'COURIER_PICKUP_SCHEDULED', 'TRACKING_ALREADY_GENERATED', 'ALREADY_HANDED_TO_COURIER', 'OTHER_OPERATIONAL_REASON');

-- CreateEnum
CREATE TYPE "CancellationHistoryAction" AS ENUM ('CREATED', 'BRAND_RESPONDED', 'APPROVED', 'REJECTED', 'EXPIRED', 'AUTO_APPROVED', 'CANCELLED_BY_USER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_PLACED', 'PAYMENT_SUCCESS', 'ORDER_STATUS_UPDATED', 'SUBORDER_CONFIRMED', 'SUBORDER_SHIPPED', 'SUBORDER_DELIVERED', 'SUBORDER_CANCELLED', 'BRAND_ORDER_ASSIGNED', 'PRODUCT_APPROVED', 'PRODUCT_REJECTED', 'PRODUCT_REVIEW_SUBMITTED', 'PRODUCT_REVIEW_REPORTED', 'PRODUCT_REVIEW_MODERATED', 'PRODUCT_REVIEW_REPLIED', 'ACCOUNT_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('VISIBLE', 'HIDDEN', 'FLAGGED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReviewReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('SPAM', 'INAPPROPRIATE', 'OFFENSIVE_LANGUAGE', 'FAKE_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewModerationAction" AS ENUM ('HIDE', 'UNHIDE', 'FLAG', 'REMOVE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('DASHBOARD', 'EMAIL', 'PUSH', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('SENT', 'QUEUED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "ProductApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('SHOPIFY_JSON', 'WOOCOMMERCE_JSON', 'CUSTOM_JSON', 'CSV', 'REST_API', 'MANUAL_UPLOAD');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'PARTIAL_SUCCESS', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportLogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "ProductApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InventorySyncState" AS ENUM ('IDLE', 'PENDING', 'SYNCING', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductTemplateType" AS ENUM ('SIZE_GUIDE', 'DELIVERIES_RETURNS', 'SHIPPING_DELIVERY', 'FABRIC_CARE');

-- CreateEnum
CREATE TYPE "UserActivityEventType" AS ENUM ('PRODUCT_VIEW', 'PRODUCT_CLICK', 'PRODUCT_ADDED_TO_CART', 'PRODUCT_REMOVED_FROM_CART', 'PRODUCT_PURCHASED', 'PRODUCT_RETURNED', 'PRODUCT_CANCELLED', 'SEARCH_QUERY', 'CATEGORY_BROWSE', 'FILTER_USED', 'WISHLIST_ADDED', 'CHECKOUT_STARTED', 'ORDER_PLACED', 'RECOMMENDATION_CLICK', 'EXPLICIT_PRODUCT_INTEREST');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'BRAND_REVIEWING', 'NEED_MORE_EVIDENCE', 'BRAND_APPROVED', 'BRAND_REJECTED', 'ADMIN_REVIEWING', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'REVIEWING', 'APPROVED', 'REJECTED', 'RETURN_ARRANGED', 'PICKUP_SCHEDULED', 'RETURN_IN_TRANSIT', 'IN_TRANSIT', 'RETURN_RECEIVED', 'RETURN_CONDITION_APPROVED', 'RETURN_CONDITION_DISPUTED', 'RECEIVED', 'REFUND_INITIATED', 'REFUND_PROCESSING', 'REFUND_COMPLETED', 'REPLACEMENT_PROCESSING', 'REPLACEMENT_PACKED', 'REPLACEMENT_READY_FOR_PICKUP', 'REPLACEMENT_SHIPPED', 'REPLACEMENT_OUT_FOR_DELIVERY', 'REPLACEMENT_DELIVERY_FAILED', 'REPLACEMENT_ADDRESS_CORRECTION_REQUIRED', 'REPLACEMENT_READY_FOR_REDELIVERY', 'REPLACEMENT_SHIPMENT_RETURNED', 'REPLACEMENT_DELIVERED', 'EXCHANGE_COMPLETED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReturnRequestType" AS ENUM ('RETURN', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "ReturnResolution" AS ENUM ('REFUND', 'EXCHANGE_SIZE', 'EXCHANGE_COLOR', 'EXCHANGE_DAMAGED_REPLACEMENT', 'EXCHANGE_WRONG_ITEM_REPLACEMENT', 'EXCHANGE_OTHER', 'STORE_CREDIT');

-- CreateEnum
CREATE TYPE "ReturnBrandRecommendation" AS ENUM ('APPROVE', 'REJECT', 'NEED_MORE_EVIDENCE');

-- CreateEnum
CREATE TYPE "ReturnAdminDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReturnReasonCode" AS ENUM ('DAMAGED_ITEM', 'DEFECTIVE_PRODUCT', 'WRONG_ITEM', 'WRONG_SIZE', 'WRONG_COLOR', 'SIZE_ISSUE', 'DIFFERENT_FROM_IMAGES', 'QUALITY_ISSUE', 'CHANGED_MIND', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('ORIGINAL_SOURCE', 'BANK_TRANSFER', 'WALLET_CREDIT');

-- CreateEnum
CREATE TYPE "PaymentSessionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefundReasonCode" AS ENUM ('BRAND_CANCELLATION', 'CUSTOMER_CANCELLATION', 'DELIVERY_FAILURE', 'RETURNED_PRODUCT', 'FAILED_PAYMENT', 'DUPLICATE_PAYMENT', 'PAYMENT_CAPTURED_ORDER_FAILED', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundRequestedBy" AS ENUM ('USER', 'BRAND', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ProductGender" AS ENUM ('MEN', 'WOMEN', 'BOYS', 'GIRLS', 'UNISEX');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('TOP', 'BOTTOM', 'FOOTWEAR', 'ACCESSORY');

-- CreateEnum
CREATE TYPE "ProductDepartment" AS ENUM ('CLOTHING', 'FOOTWEAR', 'ACCESSORIES');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('SHIRTS', 'T_SHIRTS', 'POLOS', 'JEANS', 'TROUSERS', 'SHORTS', 'HOODIES', 'JACKETS', 'SNEAKERS', 'LOAFERS', 'SANDALS', 'CAPS', 'BAGS', 'BELTS', 'SOCKS', 'SWEATSHIRTS', 'JOGGERS', 'CARGO_PANTS', 'FORMAL_PANTS', 'CHINOS', 'KURTAS', 'SHALWAR_KAMEEZ', 'WAISTCOATS', 'BLAZERS', 'COATS', 'SWEATERS', 'CARDIGANS', 'VESTS', 'TANK_TOPS', 'DRESSES', 'SKIRTS', 'LEGGINGS', 'BOOTS', 'FLATS', 'HEELS', 'SLIPPERS', 'WATCHES', 'SUNGLASSES', 'WALLETS', 'SCARVES', 'TIES');

-- CreateEnum
CREATE TYPE "ProductSubcategory" AS ENUM ('TEXTURED_SHIRT', 'EMBROIDERED_SHIRT', 'KNIT_SHIRT', 'PRINTED_SHIRT', 'FORMAL_SHIRT', 'CASUAL_SHIRT', 'DENIM_SHIRT', 'FLANNEL_SHIRT', 'OXFORD_SHIRT', 'LINEN_SHIRT', 'GRAPHIC_TSHIRT', 'PLAIN_TSHIRT', 'OVERSIZED_TSHIRT', 'HENLEY_TSHIRT', 'V_NECK_TSHIRT', 'CREW_NECK_TSHIRT', 'POCKET_TSHIRT', 'STRIPED_TSHIRT', 'PIQUE_POLO', 'TIPPED_POLO', 'CLASSIC_POLO', 'PERFORMANCE_POLO', 'SLIM_FIT_JEANS', 'REGULAR_FIT_JEANS', 'RELAXED_FIT_JEANS', 'SKINNY_JEANS', 'STRAIGHT_LEG_JEANS', 'BOOTCUT_JEANS', 'DISTRESSED_JEANS', 'DARK_WASH_JEANS', 'LIGHT_WASH_JEANS', 'RAW_DENIM_JEANS', 'CHINO_TROUSERS', 'DRESS_TROUSERS', 'PLEATED_TROUSERS', 'FLAT_FRONT_TROUSERS', 'CARGO_SHORTS', 'DENIM_SHORTS', 'CHINO_SHORTS', 'ATHLETIC_SHORTS', 'SWIM_SHORTS', 'ZIP_HOODIE', 'PULLOVER_HOODIE', 'GRAPHIC_HOODIE', 'FLEECE_HOODIE', 'BOMBER_JACKET', 'DENIM_JACKET', 'LEATHER_JACKET', 'WINDBREAKER', 'PUFFER_JACKET', 'VARSITY_JACKET', 'RUNNING_SNEAKER', 'LIFESTYLE_SNEAKER', 'TRAINING_SNEAKER', 'CASUAL_SNEAKER', 'HIGH_TOP_SNEAKER', 'LOW_TOP_SNEAKER', 'CANVAS_SNEAKER', 'SLIP_ON_SNEAKER', 'FORMAL_LOAFER', 'CASUAL_LOAFER', 'PENNY_LOAFER', 'TASSEL_LOAFER', 'SLIDE_SANDAL', 'FLIP_FLOP_SANDAL', 'SPORT_SANDAL', 'GLADIATOR_SANDAL', 'BASEBALL_CAP', 'SNAPBACK_CAP', 'FITTED_CAP', 'TRUCKER_CAP', 'BEANIE', 'BUCKET_HAT', 'BACKPACK', 'MESSENGER_BAG', 'TOTE_BAG', 'DUFFLE_BAG', 'CROSSBODY_BAG', 'CLUTCH', 'LEATHER_BELT', 'CANVAS_BELT', 'BRAIDED_BELT', 'REVERSIBLE_BELT', 'DRESS_SOCKS', 'ATHLETIC_SOCKS', 'ANKLE_SOCKS', 'NO_SHOW_SOCKS');

-- CreateEnum
CREATE TYPE "ProductAvailability" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK', 'LOW_STOCK', 'PREORDER', 'DISCONTINUED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "password" TEXT,
    "googleId" TEXT,
    "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "role" "Role" NOT NULL DEFAULT 'USER',
    "brandId" TEXT,
    "brandInviteTokenHash" TEXT,
    "brandInviteTokenExpiresAt" TIMESTAMP(3),
    "brandInviteAcceptedAt" TIMESTAMP(3),
    "codRefusalCount" INTEGER NOT NULL DEFAULT 0,
    "lastCodRefusalAt" TIMESTAMP(3),
    "codReviewFlag" BOOLEAN NOT NULL DEFAULT false,
    "codReviewStatus" "CodReviewStatus" NOT NULL DEFAULT 'CLEAR',
    "codReviewNote" TEXT,
    "codBlockedAt" TIMESTAMP(3),
    "codPrepaymentRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerificationTokenExpiresAt" TIMESTAMP(3),
    "emailVerificationTokenHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordResetTokenExpiresAt" TIMESTAMP(3),
    "passwordResetTokenHash" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserPaymentType" NOT NULL,
    "label" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expiresMonth" INTEGER,
    "expiresYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableBalancePkr" INTEGER NOT NULL DEFAULT 0,
    "totalCreditedPkr" INTEGER NOT NULL DEFAULT 0,
    "totalDebitedPkr" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "sourceType" "WalletTransactionSource" NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "balanceAfterPkr" INTEGER NOT NULL,
    "note" TEXT,
    "orderId" TEXT,
    "refundRequestId" TEXT,
    "paymentTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Pakistan',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "promoEmails" BOOLEAN NOT NULL DEFAULT false,
    "securityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "wishlistAlerts" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'WEB',
    "userAgent" TEXT,
    "disabledAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "selectedColor" TEXT,
    "selectedSize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "apiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" TEXT,
    "whatsappNumber" TEXT,
    "returnWindowDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "canManageProducts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "approvalStatus" "ProductApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "approvalReviewedAt" TIMESTAMP(3),
    "approvalReviewedById" TEXT,
    "searchDocument" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT NOT NULL,
    "gender" "ProductGender" NOT NULL,
    "productType" "ProductType" NOT NULL,
    "department" "ProductDepartment" NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "subcategory" "ProductSubcategory",
    "brandCategoryRaw" TEXT,
    "brandSubcategoryRaw" TEXT,
    "colors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sizes" TEXT[],
    "material" TEXT,
    "fit" TEXT,
    "season" TEXT,
    "collection" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "searchKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availabilityStatus" "ProductAvailability" NOT NULL DEFAULT 'IN_STOCK',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "classificationConfidence" DOUBLE PRECISION,
    "productUrl" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'visible',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "actualPrice" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION,
    "discountPercentage" DOUBLE PRECISION,
    "pricePkr" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "label" TEXT,
    "saleStartDate" TIMESTAMP(3),
    "saleEndDate" TIMESTAMP(3),
    "imageUrl" TEXT NOT NULL,
    "sizeGuideTemplateId" TEXT,
    "sizeGuide" JSONB,
    "deliveriesReturnsTemplateId" TEXT,
    "deliveriesReturns" JSONB,
    "shippingDeliveryTemplateId" TEXT,
    "shippingDelivery" JSONB,
    "fabricCareTemplateId" TEXT,
    "fabricCare" JSONB,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "externalProductId" TEXT,
    "externalSource" TEXT,
    "importHash" TEXT,
    "pageContext" JSONB,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubCategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "externalVariantId" TEXT,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "color" TEXT,
    "colorHex" TEXT,
    "size" TEXT,
    "fit" TEXT,
    "season" TEXT,
    "style" TEXT,
    "pricePkr" INTEGER NOT NULL,
    "salePricePkr" INTEGER,
    "compareAtPricePkr" INTEGER,
    "stockStatus" TEXT NOT NULL DEFAULT 'in_stock',
    "lowStockThreshold" INTEGER,
    "weight" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "url" TEXT NOT NULL,
    "cdnUrl" TEXT,
    "altText" TEXT,
    "imageType" TEXT NOT NULL DEFAULT 'gallery',
    "width" INTEGER,
    "height" INTEGER,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dedupeHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDetail" (
    "productId" TEXT NOT NULL,
    "fabricComposition" TEXT,
    "careGuide" TEXT,
    "fitDetails" TEXT,
    "modelDetails" TEXT,
    "sizeGuideText" TEXT,
    "sizeGuideImageUrl" TEXT,
    "shippingDelivery" TEXT,
    "returnExchangePolicy" TEXT,
    "disclaimer" TEXT,
    "materialDetails" TEXT,
    "origin" TEXT,
    "packageIncludes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDetail_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "ProductShipping" (
    "productId" TEXT NOT NULL,
    "estimatedDeliveryMinDays" INTEGER,
    "estimatedDeliveryMaxDays" INTEGER,
    "deliveryText" TEXT,
    "shippingFee" INTEGER,
    "freeShippingAvailable" BOOLEAN,
    "codAvailable" BOOLEAN,
    "returnAvailable" BOOLEAN,
    "exchangeAvailable" BOOLEAN,
    "returnWindowDays" INTEGER,
    "exchangeWindowDays" INTEGER,
    "nonReturnableReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductShipping_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "ProductSEO" (
    "productId" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "canonicalUrl" TEXT,
    "ogImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSEO_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "ProductImportMeta" (
    "productId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "sourceFormat" TEXT,
    "sourceBrandName" TEXT,
    "rawProductData" JSONB,
    "mappingStatus" TEXT,
    "validationErrors" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImportMeta_pkey" PRIMARY KEY ("productId")
);

-- CreateTable
CREATE TABLE "ProductAttribute" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTag" (
    "id" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTagOnProduct" (
    "productId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductTagOnProduct_pkey" PRIMARY KEY ("productId","tagId")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "sourceLabel" TEXT,
    "sourceLocation" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "successfulRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "productId" TEXT,
    "level" "ImportLogLevel" NOT NULL DEFAULT 'INFO',
    "code" TEXT,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawImportData" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "productId" TEXT,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "normalizedHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawImportData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductApproval" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "importJobId" TEXT,
    "status" "ProductApprovalState" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "rejectionReason" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "available" INTEGER NOT NULL DEFAULT 0,
    "lowStockAt" INTEGER NOT NULL DEFAULT 5,
    "syncState" "InventorySyncState" NOT NULL DEFAULT 'IDLE',
    "lastSyncedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductContentTemplate" (
    "id" TEXT NOT NULL,
    "type" "ProductTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "brandId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductContentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "totalPkr" INTEGER NOT NULL,
    "deliveryAddress" TEXT NOT NULL,
    "trackingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "gateway" "PaymentMethod" NOT NULL,
    "gatewayTransactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountPkr" INTEGER NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'DEMO_GATEWAY',
    "gatewayTransactionId" TEXT NOT NULL,
    "status" "PaymentSessionStatus" NOT NULL DEFAULT 'PENDING',
    "redirectUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastErrorReason" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subOrderId" TEXT,
    "productId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePkr" INTEGER NOT NULL,
    "selectedColor" TEXT,
    "selectedSize" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotalPkr" INTEGER NOT NULL,
    "trackingId" TEXT,
    "courierName" TEXT,
    "estimatedDelivery" TIMESTAMP(3),
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "failureReasonMessage" TEXT,
    "deliveryFailedAt" TIMESTAMP(3),
    "brandReminderSentAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptDate" TIMESTAMP(3),
    "finalDeliveryFailureAt" TIMESTAMP(3),
    "refundProcessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "orderItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requestedByRole" "CancellationRequestedBy" NOT NULL,
    "requestedById" TEXT,
    "reasonCode" "CancellationReasonCode" NOT NULL,
    "reasonText" TEXT,
    "status" "CancellationRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "brandResponseCode" "CancellationBrandResponse",
    "brandResponseNote" TEXT,
    "evidenceUrl" TEXT,
    "trackingEvidence" TEXT,
    "respondedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "autoApproveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "oldStatus" "OrderStatus",
    "newStatus" "OrderStatus" NOT NULL,
    "changedByRole" "OrderStatusUpdatedBy" NOT NULL,
    "changedById" TEXT,
    "reason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationHistory" (
    "id" TEXT NOT NULL,
    "cancellationRequestId" TEXT NOT NULL,
    "action" "CancellationHistoryAction" NOT NULL,
    "performedByRole" "OrderStatusUpdatedBy" NOT NULL,
    "performedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestType" "ReturnRequestType",
    "orderItemIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reasonCode" "ReturnReasonCode" NOT NULL,
    "reasonText" TEXT,
    "customerNote" TEXT,
    "preferredResolution" "ReturnResolution" NOT NULL DEFAULT 'REFUND',
    "requestedExchangeType" TEXT,
    "requestedVariantSummary" TEXT,
    "requestedReplacementVariantId" TEXT,
    "requestedReplacementSize" TEXT,
    "requestedReplacementColor" TEXT,
    "customerRefundPreference" TEXT,
    "evidenceImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandRecommendation" "ReturnBrandRecommendation",
    "brandRejectReason" TEXT,
    "brandRecommendationNote" TEXT,
    "brandEvidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandConditionNote" TEXT,
    "brandDamageNote" TEXT,
    "canFulfillReplacement" BOOLEAN,
    "brandRecommendedAt" TIMESTAMP(3),
    "replacementUnavailable" BOOLEAN NOT NULL DEFAULT false,
    "replacementUnavailableReason" TEXT,
    "damageEvidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "damageClaimNote" TEXT,
    "damageClaimSubmittedAt" TIMESTAMP(3),
    "convertedToRefund" BOOLEAN NOT NULL DEFAULT false,
    "replacementStatus" "ReplacementStatus",
    "replacementTrackingNo" TEXT,
    "replacementCourier" TEXT,
    "replacementSku" TEXT,
    "replacementDispatchDate" TIMESTAMP(3),
    "replacementEstimatedDelivery" TIMESTAMP(3),
    "replacementShipmentNote" TEXT,
    "replacementDeliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "replacementFailureReason" TEXT,
    "replacementFailureReasonMessage" TEXT,
    "replacementNextAttemptDate" TIMESTAMP(3),
    "replacementLastAttemptAt" TIMESTAMP(3),
    "replacementDeliveryFailedAt" TIMESTAMP(3),
    "replacementFinalFailureAt" TIMESTAMP(3),
    "replacementDeliveredAt" TIMESTAMP(3),
    "adminDecision" "ReturnAdminDecision",
    "adminDecisionNote" TEXT,
    "adminRejectedReason" TEXT,
    "pickupCourier" TEXT,
    "pickupDate" TIMESTAMP(3),
    "pickupAddress" TEXT,
    "pickupNote" TEXT,
    "returnTrackingNumber" TEXT,
    "returnReceivedAt" TIMESTAMP(3),
    "returnReceivedByBrandId" TEXT,
    "returnReceiptConditionNote" TEXT,
    "returnReceiptEvidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "refundStatusSnapshot" TEXT,
    "noReceiptReportedAt" TIMESTAMP(3),
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "reviewNote" TEXT,
    "pickupTracking" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnStatusLog" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL,
    "updatedBy" "OrderStatusUpdatedBy" NOT NULL,
    "updatedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnHistory" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "oldStatus" "ReturnStatus",
    "newStatus" "ReturnStatus" NOT NULL,
    "performedByRole" "OrderStatusUpdatedBy" NOT NULL,
    "performedById" TEXT,
    "brandRecommendation" "ReturnBrandRecommendation",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "returnRequestId" TEXT,
    "requestedByRole" "RefundRequestedBy" NOT NULL,
    "requestedById" TEXT,
    "reasonCode" "RefundReasonCode" NOT NULL,
    "reasonText" TEXT,
    "method" "RefundMethod" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "amountPkr" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "gatewayRefundId" TEXT,
    "adjustedAmountPkr" INTEGER,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRequestItem" (
    "id" TEXT NOT NULL,
    "refundRequestId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "refundAmountPkr" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundStatusLog" (
    "id" TEXT NOT NULL,
    "refundRequestId" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL,
    "updatedBy" "OrderStatusUpdatedBy" NOT NULL,
    "updatedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundHistory" (
    "id" TEXT NOT NULL,
    "refundRequestId" TEXT NOT NULL,
    "oldStatus" "RefundStatus",
    "newStatus" "RefundStatus" NOT NULL,
    "performedByRole" "OrderStatusUpdatedBy" NOT NULL,
    "performedById" TEXT,
    "adjustedAmount" INTEGER,
    "gatewayReference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(120),
    "content" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'VISIBLE',
    "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT true,
    "moderatedById" TEXT,
    "moderationReason" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewImage" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewHelpfulnessVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isHelpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewHelpfulnessVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reportedByUserId" TEXT NOT NULL,
    "reason" "ReviewReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReviewReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewModerationLog" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "action" "ReviewModerationAction" NOT NULL,
    "moderatorId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewModerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandReviewReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandReviewReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReviewAggregate" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "rating1" INTEGER NOT NULL DEFAULT 0,
    "rating2" INTEGER NOT NULL DEFAULT 0,
    "rating3" INTEGER NOT NULL DEFAULT 0,
    "rating4" INTEGER NOT NULL DEFAULT 0,
    "rating5" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReviewAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "updatedBy" "OrderStatusUpdatedBy" NOT NULL,
    "updatedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubOrderStatusLog" (
    "id" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "updatedBy" "OrderStatusUpdatedBy" NOT NULL,
    "updatedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubOrderStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandId" TEXT,
    "orderId" TEXT,
    "targetPath" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "channel" "NotificationChannel" NOT NULL DEFAULT 'DASHBOARD',
    "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "failedReason" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationChannelLog" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "recipient" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationChannelLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousSessionId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "brandId" TEXT,
    "eventType" "UserActivityEventType" NOT NULL,
    "searchQuery" TEXT,
    "filters" JSONB,
    "sourcePage" TEXT,
    "device" TEXT,
    "gender" TEXT,
    "topCategory" TEXT,
    "subCategory" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRecommendationProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredGender" TEXT,
    "topCategories" JSONB NOT NULL,
    "topSubCategories" JSONB NOT NULL,
    "topBrands" JSONB NOT NULL,
    "topColors" JSONB NOT NULL,
    "topSizes" JSONB NOT NULL,
    "topFits" JSONB NOT NULL,
    "styleTags" JSONB NOT NULL,
    "priceMinPkr" INTEGER,
    "priceMaxPkr" INTEGER,
    "lastAnonymousSessionId" TEXT,
    "lastBuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRecommendationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationImpression" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousSessionId" TEXT,
    "surface" TEXT NOT NULL DEFAULT 'FOR_YOU',
    "algorithm" TEXT NOT NULL DEFAULT 'hybrid_v2',
    "productIds" TEXT[],
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationImpression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationClick" (
    "id" TEXT NOT NULL,
    "impressionId" TEXT,
    "userId" TEXT,
    "anonymousSessionId" TEXT,
    "productId" TEXT NOT NULL,
    "surface" TEXT NOT NULL DEFAULT 'FOR_YOU',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_brandId_key" ON "User"("brandId");

-- CreateIndex
CREATE INDEX "UserPaymentMethod_userId_createdAt_idx" ON "UserPaymentMethod"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_userId_key" ON "UserWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_refundRequestId_key" ON "WalletTransaction"("refundRequestId");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_createdAt_idx" ON "WalletTransaction"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_orderId_createdAt_idx" ON "WalletTransaction"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "UserAddress_userId_isDefault_idx" ON "UserAddress"("userId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserDeviceToken_token_key" ON "UserDeviceToken"("token");

-- CreateIndex
CREATE INDEX "UserDeviceToken_userId_disabledAt_idx" ON "UserDeviceToken"("userId", "disabledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "CartItem_cartId_productId_selectedColor_selectedSize_key" ON "CartItem"("cartId", "productId", "selectedColor", "selectedSize");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenId_key" ON "Session"("tokenId");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "BrandMember_brandId_idx" ON "BrandMember"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandMember_userId_brandId_key" ON "BrandMember"("userId", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_gender_department_category_idx" ON "Product"("gender", "department", "category");

-- CreateIndex
CREATE INDEX "Product_brandId_category_subcategory_idx" ON "Product"("brandId", "category", "subcategory");

-- CreateIndex
CREATE INDEX "Product_category_subcategory_idx" ON "Product"("category", "subcategory");

-- CreateIndex
CREATE INDEX "Product_department_category_idx" ON "Product"("department", "category");

-- CreateIndex
CREATE INDEX "Product_productType_idx" ON "Product"("productType");

-- CreateIndex
CREATE INDEX "Product_pricePkr_idx" ON "Product"("pricePkr");

-- CreateIndex
CREATE INDEX "Product_brandId_externalProductId_idx" ON "Product"("brandId", "externalProductId");

-- CreateIndex
CREATE INDEX "Product_brandId_approvalStatus_deletedAt_idx" ON "Product"("brandId", "approvalStatus", "deletedAt");

-- CreateIndex
CREATE INDEX "Product_classificationConfidence_idx" ON "Product"("classificationConfidence");

-- CreateIndex
CREATE INDEX "Product_availabilityStatus_isActive_idx" ON "Product"("availabilityStatus", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Product_brandId_externalSource_externalProductId_key" ON "Product"("brandId", "externalSource", "externalProductId");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_brandId_slug_key" ON "Category"("brandId", "slug");

-- CreateIndex
CREATE INDEX "SubCategory_name_idx" ON "SubCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubCategory_categoryId_slug_key" ON "SubCategory"("categoryId", "slug");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_color_size_idx" ON "ProductVariant"("productId", "color", "size");

-- CreateIndex
CREATE INDEX "ProductVariant_barcode_idx" ON "ProductVariant"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_productId_imageType_idx" ON "ProductImage"("productId", "imageType");

-- CreateIndex
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");

-- CreateIndex
CREATE INDEX "ProductImage_dedupeHash_idx" ON "ProductImage"("dedupeHash");

-- CreateIndex
CREATE INDEX "ProductImportMeta_importBatchId_idx" ON "ProductImportMeta"("importBatchId");

-- CreateIndex
CREATE INDEX "ProductImportMeta_sourceFormat_mappingStatus_idx" ON "ProductImportMeta"("sourceFormat", "mappingStatus");

-- CreateIndex
CREATE INDEX "ProductAttribute_productId_key_idx" ON "ProductAttribute"("productId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTag_brandId_slug_key" ON "ProductTag"("brandId", "slug");

-- CreateIndex
CREATE INDEX "ProductTagOnProduct_tagId_idx" ON "ProductTagOnProduct"("tagId");

-- CreateIndex
CREATE INDEX "ImportJob_brandId_status_createdAt_idx" ON "ImportJob"("brandId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportLog_importJobId_level_createdAt_idx" ON "ImportLog"("importJobId", "level", "createdAt");

-- CreateIndex
CREATE INDEX "RawImportData_importJobId_externalId_idx" ON "RawImportData"("importJobId", "externalId");

-- CreateIndex
CREATE INDEX "RawImportData_normalizedHash_idx" ON "RawImportData"("normalizedHash");

-- CreateIndex
CREATE INDEX "ProductApproval_status_createdAt_idx" ON "ProductApproval"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductApproval_importJobId_status_idx" ON "ProductApproval"("importJobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_variantId_key" ON "Inventory"("variantId");

-- CreateIndex
CREATE INDEX "Inventory_syncState_updatedAt_idx" ON "Inventory"("syncState", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_sku_key" ON "Inventory"("productId", "sku");

-- CreateIndex
CREATE INDEX "ProductContentTemplate_type_idx" ON "ProductContentTemplate"("type");

-- CreateIndex
CREATE INDEX "ProductContentTemplate_brandId_type_idx" ON "ProductContentTemplate"("brandId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ProductContentTemplate_name_type_brandId_key" ON "ProductContentTemplate"("name", "type", "brandId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_userId_productId_key" ON "WishlistItem"("userId", "productId");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_gatewayTransactionId_key" ON "PaymentTransaction"("gatewayTransactionId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_createdAt_idx" ON "PaymentTransaction"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSession_gatewayTransactionId_key" ON "PaymentSession"("gatewayTransactionId");

-- CreateIndex
CREATE INDEX "PaymentSession_orderId_createdAt_idx" ON "PaymentSession"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentSession_userId_createdAt_idx" ON "PaymentSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentSession_status_expiresAt_idx" ON "PaymentSession"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "OrderItem_brandId_orderId_idx" ON "OrderItem"("brandId", "orderId");

-- CreateIndex
CREATE INDEX "OrderItem_subOrderId_idx" ON "OrderItem"("subOrderId");

-- CreateIndex
CREATE INDEX "SubOrder_brandId_status_idx" ON "SubOrder"("brandId", "status");

-- CreateIndex
CREATE INDEX "SubOrder_orderId_createdAt_idx" ON "SubOrder"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubOrder_orderId_brandId_key" ON "SubOrder"("orderId", "brandId");

-- CreateIndex
CREATE INDEX "CancellationRequest_orderId_createdAt_idx" ON "CancellationRequest"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "CancellationRequest_subOrderId_status_createdAt_idx" ON "CancellationRequest"("subOrderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CancellationRequest_brandId_status_createdAt_idx" ON "CancellationRequest"("brandId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CancellationRequest_status_expiresAt_idx" ON "CancellationRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "CancellationRequest_status_autoApproveAt_idx" ON "CancellationRequest"("status", "autoApproveAt");

-- CreateIndex
CREATE INDEX "StatusHistory_subOrderId_createdAt_idx" ON "StatusHistory"("subOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "StatusHistory_newStatus_createdAt_idx" ON "StatusHistory"("newStatus", "createdAt");

-- CreateIndex
CREATE INDEX "CancellationHistory_cancellationRequestId_createdAt_idx" ON "CancellationHistory"("cancellationRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderId_createdAt_idx" ON "ReturnRequest"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnRequest_subOrderId_status_createdAt_idx" ON "ReturnRequest"("subOrderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnRequest_userId_createdAt_idx" ON "ReturnRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnStatusLog_returnRequestId_createdAt_idx" ON "ReturnStatusLog"("returnRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnHistory_returnRequestId_createdAt_idx" ON "ReturnHistory"("returnRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "ReturnHistory_newStatus_createdAt_idx" ON "ReturnHistory"("newStatus", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequest_orderId_createdAt_idx" ON "RefundRequest"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequest_subOrderId_status_createdAt_idx" ON "RefundRequest"("subOrderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequest_status_createdAt_idx" ON "RefundRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequest_requestedByRole_createdAt_idx" ON "RefundRequest"("requestedByRole", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequestItem_refundRequestId_idx" ON "RefundRequestItem"("refundRequestId");

-- CreateIndex
CREATE INDEX "RefundRequestItem_orderItemId_idx" ON "RefundRequestItem"("orderItemId");

-- CreateIndex
CREATE INDEX "RefundStatusLog_refundRequestId_createdAt_idx" ON "RefundStatusLog"("refundRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "RefundHistory_refundRequestId_createdAt_idx" ON "RefundHistory"("refundRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "RefundHistory_newStatus_createdAt_idx" ON "RefundHistory"("newStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");

-- CreateIndex
CREATE INDEX "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_userId_createdAt_idx" ON "Review"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Review_brandId_status_createdAt_idx" ON "Review"("brandId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewImage_reviewId_sortOrder_idx" ON "ReviewImage"("reviewId", "sortOrder");

-- CreateIndex
CREATE INDEX "ReviewHelpfulnessVote_reviewId_idx" ON "ReviewHelpfulnessVote"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewHelpfulnessVote_reviewId_userId_key" ON "ReviewHelpfulnessVote"("reviewId", "userId");

-- CreateIndex
CREATE INDEX "ReviewReport_reviewId_status_createdAt_idx" ON "ReviewReport"("reviewId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewReport_reportedByUserId_createdAt_idx" ON "ReviewReport"("reportedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewModerationLog_reviewId_createdAt_idx" ON "ReviewModerationLog"("reviewId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BrandReviewReply_reviewId_key" ON "BrandReviewReply"("reviewId");

-- CreateIndex
CREATE INDEX "BrandReviewReply_brandId_createdAt_idx" ON "BrandReviewReply"("brandId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReviewAggregate_productId_key" ON "ProductReviewAggregate"("productId");

-- CreateIndex
CREATE INDEX "OrderStatusLog_orderId_createdAt_idx" ON "OrderStatusLog"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "SubOrderStatusLog_subOrderId_createdAt_idx" ON "SubOrderStatusLog"("subOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_brandId_createdAt_idx" ON "Notification"("brandId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationChannelLog_notificationId_idx" ON "NotificationChannelLog"("notificationId");

-- CreateIndex
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_userId_eventType_createdAt_idx" ON "UserActivity"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_anonymousSessionId_createdAt_idx" ON "UserActivity"("anonymousSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_anonymousSessionId_eventType_createdAt_idx" ON "UserActivity"("anonymousSessionId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_brandId_eventType_createdAt_idx" ON "UserActivity"("brandId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_topCategory_subCategory_createdAt_idx" ON "UserActivity"("topCategory", "subCategory", "createdAt");

-- CreateIndex
CREATE INDEX "UserActivity_productId_eventType_createdAt_idx" ON "UserActivity"("productId", "eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserRecommendationProfile_userId_key" ON "UserRecommendationProfile"("userId");

-- CreateIndex
CREATE INDEX "UserRecommendationProfile_preferredGender_lastBuiltAt_idx" ON "UserRecommendationProfile"("preferredGender", "lastBuiltAt");

-- CreateIndex
CREATE INDEX "UserRecommendationProfile_lastBuiltAt_idx" ON "UserRecommendationProfile"("lastBuiltAt");

-- CreateIndex
CREATE INDEX "RecommendationImpression_userId_createdAt_idx" ON "RecommendationImpression"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationImpression_anonymousSessionId_createdAt_idx" ON "RecommendationImpression"("anonymousSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationImpression_surface_createdAt_idx" ON "RecommendationImpression"("surface", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationImpression_algorithm_createdAt_idx" ON "RecommendationImpression"("algorithm", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationClick_impressionId_createdAt_idx" ON "RecommendationClick"("impressionId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationClick_userId_createdAt_idx" ON "RecommendationClick"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationClick_anonymousSessionId_createdAt_idx" ON "RecommendationClick"("anonymousSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationClick_productId_createdAt_idx" ON "RecommendationClick"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationClick_surface_createdAt_idx" ON "RecommendationClick"("surface", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPaymentMethod" ADD CONSTRAINT "UserPaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWallet" ADD CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAddress" ADD CONSTRAINT "UserAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDeviceToken" ADD CONSTRAINT "UserDeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMember" ADD CONSTRAINT "BrandMember_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandMember" ADD CONSTRAINT "BrandMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCategory" ADD CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDetail" ADD CONSTRAINT "ProductDetail_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductShipping" ADD CONSTRAINT "ProductShipping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSEO" ADD CONSTRAINT "ProductSEO_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImportMeta" ADD CONSTRAINT "ProductImportMeta_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTag" ADD CONSTRAINT "ProductTag_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTagOnProduct" ADD CONSTRAINT "ProductTagOnProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTagOnProduct" ADD CONSTRAINT "ProductTagOnProduct_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ProductTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawImportData" ADD CONSTRAINT "RawImportData_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawImportData" ADD CONSTRAINT "RawImportData_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductApproval" ADD CONSTRAINT "ProductApproval_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductApproval" ADD CONSTRAINT "ProductApproval_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductApproval" ADD CONSTRAINT "ProductApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductContentTemplate" ADD CONSTRAINT "ProductContentTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductContentTemplate" ADD CONSTRAINT "ProductContentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSession" ADD CONSTRAINT "PaymentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubOrder" ADD CONSTRAINT "SubOrder_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubOrder" ADD CONSTRAINT "SubOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationRequest" ADD CONSTRAINT "CancellationRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationHistory" ADD CONSTRAINT "CancellationHistory_cancellationRequestId_fkey" FOREIGN KEY ("cancellationRequestId") REFERENCES "CancellationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnStatusLog" ADD CONSTRAINT "ReturnStatusLog_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnHistory" ADD CONSTRAINT "ReturnHistory_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequestItem" ADD CONSTRAINT "RefundRequestItem_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequestItem" ADD CONSTRAINT "RefundRequestItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundStatusLog" ADD CONSTRAINT "RefundStatusLog_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundHistory" ADD CONSTRAINT "RefundHistory_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewImage" ADD CONSTRAINT "ReviewImage_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelpfulnessVote" ADD CONSTRAINT "ReviewHelpfulnessVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewHelpfulnessVote" ADD CONSTRAINT "ReviewHelpfulnessVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewModerationLog" ADD CONSTRAINT "ReviewModerationLog_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewModerationLog" ADD CONSTRAINT "ReviewModerationLog_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewReply" ADD CONSTRAINT "BrandReviewReply_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewReply" ADD CONSTRAINT "BrandReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandReviewReply" ADD CONSTRAINT "BrandReviewReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReviewAggregate" ADD CONSTRAINT "ProductReviewAggregate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusLog" ADD CONSTRAINT "OrderStatusLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubOrderStatusLog" ADD CONSTRAINT "SubOrderStatusLog_subOrderId_fkey" FOREIGN KEY ("subOrderId") REFERENCES "SubOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationChannelLog" ADD CONSTRAINT "NotificationChannelLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRecommendationProfile" ADD CONSTRAINT "UserRecommendationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationImpression" ADD CONSTRAINT "RecommendationImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationClick" ADD CONSTRAINT "RecommendationClick_impressionId_fkey" FOREIGN KEY ("impressionId") REFERENCES "RecommendationImpression"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationClick" ADD CONSTRAINT "RecommendationClick_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationClick" ADD CONSTRAINT "RecommendationClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


