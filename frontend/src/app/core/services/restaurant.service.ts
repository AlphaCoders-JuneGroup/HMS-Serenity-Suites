import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './api.service';

export type MenuCategory = 'Food' | 'Beverage' | 'Dessert' | 'Special';
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
  available: boolean;
  preparationTime?: number;
}

export interface OrderLine {
  menuItem?: string;
  name: string;
  price: number;
  quantity: number;
}

export interface RestaurantOrder {
  _id?: string;
  items: OrderLine[];
  orderType: OrderType;
  roomNumber?: string;
  guest?: { _id?: string; firstName?: string; lastName?: string } | string | null;
  guestName?: string;
  status: OrderStatus;
  paymentStatus: 'Pending' | 'Paid' | 'Charged to Room';
  totalAmount: number;
  notes?: string;
  billedAt?: string;
  createdAt?: string;
}

export interface DailySales {
  totalOrders: number;
  billedOrders: number;
  revenue: number;
  byType: Record<string, number>;
  orders: RestaurantOrder[];
}

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private apiUrl = `${environment.apiUrl}/restaurant`;

  constructor(private http: HttpClient) {}

  getMenu(params?: { available?: string; category?: string }): Observable<ApiResponse<MenuItem[]>> {
    let httpParams = new HttpParams();
    if (params?.available) httpParams = httpParams.set('available', params.available);
    if (params?.category) httpParams = httpParams.set('category', params.category);
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

  getOrders(status?: string): Observable<ApiResponse<RestaurantOrder[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<RestaurantOrder[]>>(`${this.apiUrl}/orders`, { params });
  }

  createOrder(payload: {
    items: { menuItem: string; quantity: number }[];
    orderType: OrderType;
    roomNumber?: string;
    guestName?: string;
    notes?: string;
  }): Observable<ApiResponse<RestaurantOrder>> {
    return this.http.post<ApiResponse<RestaurantOrder>>(`${this.apiUrl}/orders`, payload);
  }

  updateOrderStatus(id: string, status: OrderStatus): Observable<ApiResponse<RestaurantOrder>> {
    return this.http.patch<ApiResponse<RestaurantOrder>>(`${this.apiUrl}/orders/${id}/status`, {
      status,
    });
  }

  generateBill(id: string): Observable<ApiResponse<RestaurantOrder>> {
    return this.http.patch<ApiResponse<RestaurantOrder>>(`${this.apiUrl}/orders/${id}/bill`, {});
  }

  getDailySales(date?: string): Observable<{ success: boolean; date: string; data: DailySales }> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<{ success: boolean; date: string; data: DailySales }>(
      `${this.apiUrl}/sales/daily`,
      { params }
    );
  }
}
