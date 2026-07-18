import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './api.service';

export interface BillingBreakdownEntry {
  revenue: number;
  collected: number;
  pending: number;
  pendingCount: number;
}

export interface BillingSummary {
  totalRevenue: number;
  totalCollected: number;
  totalPending: number;
  breakdown: {
    room: BillingBreakdownEntry;
    restaurant: BillingBreakdownEntry;
    event: BillingBreakdownEntry;
  };
}

export interface PendingPaymentItem {
  type: 'Room Booking' | 'Event' | 'Restaurant Order';
  id: string;
  reference: string;
  customerName: string;
  totalAmount: number;
  amountPaid: number;
  balance: number;
  paymentStatus: string;
  date: string;
}

export interface RevenueReport {
  from: string;
  to: string;
  totalRevenue: number;
  roomRevenue: number;
  eventRevenue: number;
  restaurantRevenue: number;
  bookingCount: number;
  eventCount: number;
  restaurantOrderCount: number;
  dailyTrend: { date: string; amount: number }[];
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private baseUrl = `${environment.apiUrl}/billing`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ApiResponse<BillingSummary>> {
    return this.http.get<ApiResponse<BillingSummary>>(`${this.baseUrl}/summary`);
  }

  getPendingPayments(): Observable<ApiResponse<PendingPaymentItem[]>> {
    return this.http.get<ApiResponse<PendingPaymentItem[]>>(`${this.baseUrl}/pending`);
  }

  getRevenueReport(from?: string, to?: string): Observable<ApiResponse<RevenueReport>> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<ApiResponse<RevenueReport>>(`${this.baseUrl}/revenue-report`, { params });
  }

  getBookingInvoice(bookingId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/invoice/booking/${bookingId}`);
  }

  getEventInvoice(eventId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/invoice/event/${eventId}`);
  }

  getGuestMasterInvoice(guestId: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/invoice/guest/${guestId}`);
  }
}
