export enum PaymentMethod {
  CASH = 'Espèces',
  CHECK = 'Chèque',
  TRANSFER = 'Virement',
  CARD = 'Carte Bancaire'
}

export interface Transaction {
  id: string;
  date: string; // ISO String
  amount: number;
  method: PaymentMethod;
  addedBy: string;
}

export interface Order {
  id: string;
  createdAt: string;
  
  // User Link (Nouveau)
  userId?: string;

  // User Info
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone: string;
  email: string;
  
  // Order Details
  qty24g: number;
  qty28g: number;
  
  // Financials
  totalAmount: number;
  depositRequired: number;
  transactions: Transaction[];
  
  // Logistics
  isDelivered: boolean;
  deliveryDate?: string;
}

export interface UserProfile {
  email: string;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone: string;
}

export interface PricingConfig {
  unitPrice: number;
  depositPerCarton: number;
  minCartons: number;
}

export const DEFAULT_PRICES: PricingConfig = {
  unitPrice: 92,
  depositPerCarton: 66,
  minCartons: 5
};