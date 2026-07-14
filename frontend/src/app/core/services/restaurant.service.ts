import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './api.service';

export type MenuCategory = 'Food' | 'Beverage' | 'Dessert' | 'Special' | 'Combo';
export type OrderType = 'Dine-In' | 'Room Service' | 'Takeaway';
export type OrderStatus =
  | 'Pending'
  | 'Preparing'
  | 'Ready'
  | 'Served'
  | 'Billed'
  | 'Cancelled';

export interface MenuItem {
  _id?: string;
  name: string;
  description?: string;
  category: MenuCategory;
  price: number;
  effectivePrice?: number;
  isHappyHour?: boolean;
  happyHourPrice?: number | null;
  happyHourStart?: number;
  happyHourEnd?: number;
  available: boolean;
  stock?: number | null;
  preparationTime?: number;
  isCombo?: boolean;
  allergens?: string;
  image?: string;
}

export interface OrderLine {
  menuItem?: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
}

export interface RestaurantTable {
  _id?: string;
  tableNumber: string;
  capacity: number;
  status: 'Available' | 'Occupied' | 'Reserved' | 'Cleaning';
  location?: string;
  image?: string;
  currentOrder?: string | RestaurantOrder | null;
}

export interface RestaurantOrder {
  _id?: string;
  items: OrderLine[];
  orderType: OrderType;
  table?: RestaurantTable | string | null;
  tableNumber?: string;
  roomNumber?: string;
  guest?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    preferences?: { dietaryNeeds?: string; specialNeeds?: string };
  } | string | null;
  guestName?: string;
  guestAllergies?: string;
  waiter?: string;
  status: OrderStatus;
  cancelReason?: string;
  paymentStatus: 'Pending' | 'Partial' | 'Paid' | 'Charged to Room';
  subtotal?: number;
  taxAmount?: number;
  serviceCharge?: number;
  discountPercent?: number;
  discountAmount?: number;
  totalAmount: number;
  amountPaid?: number;
  estimatedPrepMinutes?: number;
  notes?: string;
  billedAt?: string;
  createdAt?: string;
  booking?: string | { _id?: string };
}

export interface DailySales {
  totalOrders: number;
  billedOrders: number;
  revenue: number;
  byType: Record<string, number>;
  popularItems?: { name: string; qty: number; revenue: number }[];
  orders: RestaurantOrder[];
}

export interface RestaurantShift {
  _id?: string;
  status: 'Open' | 'Closed';
  openedAt?: string;
  closedAt?: string;
  openingCash?: number;
  closingCash?: number;
  expectedCash?: number;
  cardTotal?: number;
  roomChargeTotal?: number;
  orderCount?: number;
  revenue?: number;
  openedBy?: string;
  closedBy?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private apiUrl = `${environment.apiUrl}/restaurant`;

  constructor(private http: HttpClient) {}

  getMenu(params?: {
    available?: string;
    category?: string;
    q?: string;
  }): Observable<ApiResponse<MenuItem[]>> {
    let httpParams = new HttpParams();
    if (params?.available) httpParams = httpParams.set('available', params.available);
    if (params?.category) httpParams = httpParams.set('category', params.category);
    if (params?.q) httpParams = httpParams.set('q', params.q);
    return this.http.get<ApiResponse<MenuItem[]>>(`${this.apiUrl}/menu`, { params: httpParams });
  }

  createMenuItem(payload: Partial<MenuItem>): Observable<ApiResponse<MenuItem>> {
    return this.http.post<ApiResponse<MenuItem>>(`${this.apiUrl}/menu`, payload);
  }

  updateMenuItem(id: string, payload: Partial<MenuItem>): Observable<ApiResponse<MenuItem>> {
    return this.http.put<ApiResponse<MenuItem>>(`${this.apiUrl}/menu/${id}`, payload);
  }

  toggleAvailability(id: string): Observable<ApiResponse<MenuItem>> {
    return this.http.patch<ApiResponse<MenuItem>>(`${this.apiUrl}/menu/${id}/availability`, {});
  }

  deleteMenuItem(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/menu/${id}`);
  }

  uploadMenuImage(id: string, file: File): Observable<ApiResponse<MenuItem>> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<ApiResponse<MenuItem>>(`${this.apiUrl}/menu/${id}/image`, form);
  }

  assetUrl(path?: string | null): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path) || path.startsWith('data:')) return path;
    const base = environment.apiUrl.replace(/\/api$/, '');
    // Always resolve relative paths against the API host (uploads + optional /menu mirror)
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  getTables(): Observable<ApiResponse<RestaurantTable[]>> {
    return this.http.get<ApiResponse<RestaurantTable[]>>(`${this.apiUrl}/tables`);
  }

  createTable(payload: Partial<RestaurantTable>): Observable<ApiResponse<RestaurantTable>> {
    return this.http.post<ApiResponse<RestaurantTable>>(`${this.apiUrl}/tables`, payload);
  }

  updateTable(id: string, payload: Partial<RestaurantTable>): Observable<ApiResponse<RestaurantTable>> {
    return this.http.put<ApiResponse<RestaurantTable>>(`${this.apiUrl}/tables/${id}`, payload);
  }

  deleteTable(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/tables/${id}`);
  }

  getKitchen(): Observable<ApiResponse<RestaurantOrder[]>> {
    return this.http.get<ApiResponse<RestaurantOrder[]>>(`${this.apiUrl}/kitchen`);
  }

  getOrders(status?: string): Observable<ApiResponse<RestaurantOrder[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<RestaurantOrder[]>>(`${this.apiUrl}/orders`, { params });
  }

  createOrder(payload: any): Observable<ApiResponse<RestaurantOrder>> {
    return this.http.post<ApiResponse<RestaurantOrder>>(`${this.apiUrl}/orders`, payload);
  }

  updateOrder(id: string, payload: any): Observable<ApiResponse<RestaurantOrder>> {
    return this.http.put<ApiResponse<RestaurantOrder>>(`${this.apiUrl}/orders/${id}`, payload);
  }

  updateOrderStatus(
    id: string,
    status: OrderStatus,
    cancelReason?: string
  ): Observable<ApiResponse<RestaurantOrder>> {
    return this.http.patch<ApiResponse<RestaurantOrder>>(`${this.apiUrl}/orders/${id}/status`, {
      status,
      cancelReason,
    });
  }

  addPayment(
    id: string,
    payload: { amount: number; method?: string; note?: string }
  ): Observable<ApiResponse<RestaurantOrder>> {
    return this.http.post<ApiResponse<RestaurantOrder>>(
      `${this.apiUrl}/orders/${id}/payments`,
      payload
    );
  }

  generateBill(
    id: string,
    payload?: { chargeToRoom?: boolean; discountPercent?: number; method?: string }
  ): Observable<ApiResponse<RestaurantOrder>> {
    return this.http.patch<ApiResponse<RestaurantOrder>>(
      `${this.apiUrl}/orders/${id}/bill`,
      payload || {}
    );
  }

  notifyReceipt(id: string): Observable<{ success: boolean; message: string; preview?: string }> {
    return this.http.post<{ success: boolean; message: string; preview?: string }>(
      `${this.apiUrl}/orders/${id}/notify`,
      {}
    );
  }

  getDailySales(date?: string): Observable<{ success: boolean; date: string; data: DailySales }> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<{ success: boolean; date: string; data: DailySales }>(
      `${this.apiUrl}/sales/daily`,
      { params }
    );
  }

  getSalesRange(from: string, to: string): Observable<{ success: boolean; data: any }> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<{ success: boolean; data: any }>(`${this.apiUrl}/sales/range`, { params });
  }

  getCurrentShift(): Observable<ApiResponse<RestaurantShift | null>> {
    return this.http.get<ApiResponse<RestaurantShift | null>>(`${this.apiUrl}/shifts/current`);
  }

  openShift(openingCash = 0): Observable<ApiResponse<RestaurantShift>> {
    return this.http.post<ApiResponse<RestaurantShift>>(`${this.apiUrl}/shifts/open`, {
      openingCash,
    });
  }

  closeShift(payload: { closingCash?: number; notes?: string }): Observable<ApiResponse<RestaurantShift>> {
    return this.http.post<ApiResponse<RestaurantShift>>(`${this.apiUrl}/shifts/close`, payload);
  }

  getShifts(): Observable<ApiResponse<RestaurantShift[]>> {
    return this.http.get<ApiResponse<RestaurantShift[]>>(`${this.apiUrl}/shifts`);
  }
}
