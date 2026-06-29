export interface Image {
  s3Key: string;
  url: string;
  originalName?: string;
  uploadedAt: Date;
}

export interface WishlistItem {
  id: string;
  userId: string;
  title: string;
  description?: string;
  url?: string;
  price?: number;
  currency: string;
  priority: 'low' | 'medium' | 'high';
  isPurchased: boolean;
  images: Image[];
  createdAt: Date;
  updatedAt: Date;
}
