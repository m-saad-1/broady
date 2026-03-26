export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  verified: boolean;
};

export type Product = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string;
  descriptionLong?: string;
  pricePkr: number;
  topCategory: "Men" | "Women" | "Kids";
  productType?: "Top" | "Bottom" | "Footwear" | "Accessories";
  subCategory: string;
  sizes: string[];
  colors?: string[];
  badge?: "Sale" | "New" | "Limited" | "Out of Stock";
  imageUrl: string;
  stock: number;
  isActive: boolean;
  offer?: {
    percentage: number;
    isActive?: boolean;
    startsAt?: string;
    endsAt?: string;
  };
  brand?: Brand;
};

export type CartItem = {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
};

export type User = {
  id: string;
  fullName: string;
  email: string;
  role: "USER" | "ADMIN";
};

export type BrandWithProducts = Brand & {
  products: Product[];
};

export type UserPaymentType = "CARD" | "JAZZCASH" | "EASYPAISA" | "BANK";

export type UserPaymentMethod = {
  id: string;
  type: UserPaymentType;
  label: string;
  last4: string;
  expiresMonth?: number | null;
  expiresYear?: number | null;
  isDefault: boolean;
};

export type NotificationPreference = {
  id: string;
  userId: string;
  orderUpdates: boolean;
  promoEmails: boolean;
  securityAlerts: boolean;
  wishlistAlerts: boolean;
};
