export interface TransactionRaw {
  amount: number;
  orderId: string; // Signature generated from content (Date + Taker + Amount)
  taker: string;
  controller: string;
  superior: string;
  orderDate: string;
  content: string;
}

export interface IncomeDistribution {
  taker: number;        // 接单人 (Total * 80%)
  controller: number;   // 场控 (Pool * 15%)
  superior: number;     // 直属人 (Pool * 5%)
  pool: number;         // 剩下20%
  platform: number;     // What's left of the pool
}

export interface DistributionConfig {
  takerPercentage: number;
  controllerPercentage: number;
  superiorPercentage: number;
}

export interface TransactionRecord {
  id: string;
  timestamp: number;
  imageUrl?: string;
  
  // Extracted Data
  orderId: string; 
  amount: number;
  taker: string;
  controller: string;
  superior: string;
  orderDate: string;
  content: string;
  
  distribution: IncomeDistribution;
  // Store the config used for this specific transaction
  distributionConfig?: DistributionConfig; 
  
  status: 'approved' | 'rejected' | 'pending' | 'paid';
  notes?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalTaker: number;
  totalController: number;
  totalSuperior: number;
  orderCount: number;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this should be hashed. For client-side only, we store plain text.
  role: UserRole;
  name: string; // Display name
}