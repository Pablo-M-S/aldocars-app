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
