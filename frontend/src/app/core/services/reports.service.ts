import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ReportOverview {
  totalRooms: number;
  bookingsCount: number;
  roomNights: number;
  occupancyPercent: number;
  adr: number;
  roomRevenue: number;
  restaurantRevenue: number;
  revenue: number;
  pendingPayments: number;
  partialPayments: number;
  checkedIn: number;
}

export interface DailyBookingDay {
  date: string;
  created: number;
  arrivals: number;
  departures: number;
  cancelled: number;
  noShow: number;
  confirmed: number;
  checkedIn: number;
  revenueBooked: number;
}

export interface DailyBookingsReport {
  daily: DailyBookingDay[];
  totals: {
    created: number;
    arrivals: number;
    departures: number;
    cancelled: number;
    noShow: number;
    revenueBooked: number;
  };
  bookings: {
    _id: string;
    guestName: string;
    roomNumber: string;
    status: string;
    paymentStatus: string;
    checkIn: string;
    checkOut: string;
    createdAt: string;
    totalAmount: number;
    amountPaid: number;
    numberOfGuests: number;
  }[];
}

export interface RevenueReport {
  daily: {
    date: string;
    roomCollected: number;
    roomBooked: number;
    restaurant: number;
    total: number;
  }[];
  totals: {
    roomCollected: number;
    roomBooked: number;
    restaurant: number;
    total: number;
  };
  roomLines: any[];
  restaurantLines: any[];
}

export interface OccupancyReport {
  totalRooms: number;
  avgOccupancy: number;
  roomNights: number;
  statusBreakdown: Record<string, number>;
  daily: {
    date: string;
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
    occupancyPercent: number;
  }[];
  currentRooms: { _id: string; roomNumber: string; status: string }[];
}

export interface PaymentsReport {
  collected: number;
  outstandingTotal: number;
  outstandingCount: number;
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
  payments: {
    _id: string;
    source: string;
    guestName: string;
    reference: string;
    amount: number;
    method: string;
    paymentStatus: string;
    at: string;
    note?: string;
  }[];
  outstanding: {
    _id: string;
    guestName: string;
    roomNumber: string;
    paymentStatus: string;
    totalAmount: number;
    amountPaid: number;
    balance: number;
    checkOut?: string;
  }[];
}

export interface AnalyticsReport {
  current: {
    revenue: number;
    occupancyPercent: number;
    createdCount: number;
    adr: number;
    roomRevenue: number;
    restaurantRevenue: number;
    cancelledRate: number;
    roomNights: number;
  };
  previous: {
    revenue: number;
    occupancyPercent: number;
    createdCount: number;
    adr: number;
    roomRevenue: number;
    restaurantRevenue: number;
  };
  comparison: Record<
    string,
    { current: number; previous: number; changePercent: number }
  >;
  trends: {
    date: string;
    bookingsCreated: number;
    arrivals: number;
    roomRevenue: number;
    restaurantRevenue: number;
    totalRevenue: number;
    occupancyPercent: number;
    occupiedRooms: number;
  }[];
  bookingStatusMix: Record<string, number>;
  paymentMethods: Record<string, number>;
  revenueSplit: { room: number; restaurant: number };
  collectionPercent: number;
  insights: { type: string; title: string; detail: string }[];
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private apiUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  private params(from: string, to: string): HttpParams {
    return new HttpParams().set('from', from).set('to', to);
  }

  getOverview(from: string, to: string): Observable<{ success: boolean; data: ReportOverview }> {
    return this.http.get<{ success: boolean; data: ReportOverview }>(`${this.apiUrl}/overview`, {
      params: this.params(from, to),
    });
  }

  getDailyBookings(
    from: string,
    to: string
  ): Observable<{ success: boolean; data: DailyBookingsReport }> {
    return this.http.get<{ success: boolean; data: DailyBookingsReport }>(
      `${this.apiUrl}/daily-bookings`,
      { params: this.params(from, to) }
    );
  }

  getRevenue(from: string, to: string): Observable<{ success: boolean; data: RevenueReport }> {
    return this.http.get<{ success: boolean; data: RevenueReport }>(`${this.apiUrl}/revenue`, {
      params: this.params(from, to),
    });
  }

  getOccupancy(from: string, to: string): Observable<{ success: boolean; data: OccupancyReport }> {
    return this.http.get<{ success: boolean; data: OccupancyReport }>(`${this.apiUrl}/occupancy`, {
      params: this.params(from, to),
    });
  }

  getPayments(from: string, to: string): Observable<{ success: boolean; data: PaymentsReport }> {
    return this.http.get<{ success: boolean; data: PaymentsReport }>(`${this.apiUrl}/payments`, {
      params: this.params(from, to),
    });
  }

  getAnalytics(from: string, to: string): Observable<{ success: boolean; data: AnalyticsReport }> {
    return this.http.get<{ success: boolean; data: AnalyticsReport }>(`${this.apiUrl}/analytics`, {
      params: this.params(from, to),
    });
  }
}
