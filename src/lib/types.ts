export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Vehicle {
  id: string;
  customerId: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  mileage: number;
}

export interface CustomerMe {
  id: string;
  phone: string | null;
  document: string | null;
  address: string | null;
  user: { id: string; name: string; email: string };
  vehicles: Vehicle[];
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  durationMinutes: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  quantity: number;
}

export interface WorkOrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  service: { name: string } | null;
  product: { name: string } | null;
}

export interface WorkOrder {
  id: string;
  status: string;
  diagnosis: string | null;
  laborCost: string;
  totalCost: string;
  createdAt: string;
  items: WorkOrderItem[];
}

export interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: string;
  product: { name: string };
}

export interface Payment {
  id: string;
  amount: string;
  method: string;
  status: string;
  paidAt: string | null;
}

export interface Sale {
  id: string;
  totalAmount: string;
  createdAt: string;
  items: SaleItem[];
  payments: Payment[];
}

export interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  service: { name: string };
  vehicle: { plate: string; brand: string; model: string };
}

export interface ApiErrorBody {
  statusCode: number;
  path: string;
  timestamp: string;
  message: string | string[];
}
