export type Brand = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  verified: boolean;
};

export type Product = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string;
  pricePkr: number;
  category: string;
  sizes: string[];
  imageUrl: string;
  stock: number;
  isActive: boolean;
};

export type ApiResponse<T> = {
  data: T;
  message?: string;
};
