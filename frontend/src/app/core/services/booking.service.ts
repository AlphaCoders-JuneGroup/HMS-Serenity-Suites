import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './api.service';

export type BookingStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Checked-In'
  | 'Checked-Out'
  | 'Cancelled'
  | 'No-Show';

export type PaymentStatus = 'Pending' | 'Paid' | 'Partial' | 'Refunded';

export interface BookingGuest {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
}

export interface BookingRoom {
  _id?: string;
  roomNumber: string;
  type: string;
  price: number;
  status?: string;
  capacity?: number;
  floor?: number;
}

export interface BookingPayment {
  _id?: string;
  amount: number;
  method?: string;
  note?: string;
  at?: string;
}

export interface BookingNote {
  _id?: string;
  text: string;
  authorName?: string;
  at?: string;
}

export interface Booking {
  _id?: string;
  guest: BookingGuest | string;
  room: BookingRoom | string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  baseAmount?: number;
  earlyCheckInFee?: number;
  lateCheckOutFee?: number;
  discountPercent?: number;
  promoCode?: string;
  totalAmount: number;
  amountPaid?: number;
  payments?: BookingPayment[];
  paymentStatus: PaymentStatus;
  specialRequests?: string;
  numberOfGuests?: number;
  groupId?: string;
  notes?: BookingNote[];
  idDocument?: {
    originalName?: string;
    path?: string;
    mimeType?: string;
    uploadedAt?: string;
  };
  noShowAt?: string;
  createdAt?: string;
}

export interface BookingPayload {
  guest: string;
  room: string;
  checkIn: string;
  checkOut: string;
  numberOfGuests?: number;
  specialRequests?: string;
  paymentStatus?: PaymentStatus;
  status?: BookingStatus;
  totalAmount?: number;
  discountPercent?: number;
  promoCode?: string;
  groupId?: string;
}

export interface GuestPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  address?: {
    street?: string;
    city?: string;
    country?: string;
  };
}

export interface AvailabilityResponse {
  success: boolean;
  checkIn: string;
  checkOut: string;
  hours?: number;
  nights: number;
  earlyCheckInFee?: number;
  lateCheckOutFee?: number;
  count: number;
  data: BookingRoom[];
}

export interface BookingListParams {
  status?: string;
  paymentStatus?: string;
  q?: string;
  from?: string;
  to?: string;
  guest?: string;
  room?: string;
  groupId?: string;
}

export interface WaitlistItem {
  _id?: string;
  guest: BookingGuest | string;
  preferredType: string;
  checkIn: string;
  checkOut: string;
  status: 'Waiting' | 'Notified' | 'Booked' | 'Cancelled';
  notes?: string;
  numberOfGuests?: number;
}

export interface DeskTodayResponse {
  success: boolean;
  date: string;
  data: {
    arrivals: Booking[];
    departures: Booking[];
    inHouse: Booking[];
  };
  counts: { arrivals: number; departures: number; inHouse: number };
}

export interface FolioData {
  booking: Booking;
  roomCharges: number;
  earlyCheckInFee: number;
  lateCheckOutFee: number;
  restaurantOrders: any[];
  restaurantTotal: number;
  grandTotal: number;
  amountPaid: number;
  balance: number;
  payments: BookingPayment[];
}

export interface ReportSummary {
  totalRooms: number;
  bookingsCount: number;
  roomNights: number;
  occupancyPercent: number;
  adr: number;
  revenue: number;
  amountPaidTotal: number;
  pendingPayments: number;
  checkedIn: number;
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private baseUrl = environment.apiUrl;

  // Reactive event bus for booking updates
  private bookingUpdatedSource = new Subject<void>();
  bookingUpdated$ = this.bookingUpdatedSource.asObservable();

  constructor(private http: HttpClient) {}

  getBookings(params?: BookingListParams | string): Observable<ApiResponse<Booking[]>> {
    let httpParams = new HttpParams();
    if (typeof params === 'string') {
      if (params) httpParams = httpParams.set('status', params);
    } else if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') httpParams = httpParams.set(k, String(v));
      });
    }
    return this.http.get<ApiResponse<Booking[]>>(`${this.baseUrl}/bookings`, {
      params: httpParams,
    });
  }

  getBookingById(id: string): Observable<ApiResponse<Booking>> {
    return this.http.get<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}`);
  }

  createBooking(payload: BookingPayload): Observable<ApiResponse<Booking>> {
    return this.http.post<ApiResponse<Booking>>(`${this.baseUrl}/bookings`, payload).pipe(
      tap(() => this.bookingUpdatedSource.next())
    );
  }

  createGroupBooking(payload: {
    guest: string;
    rooms: string[];
    checkIn: string;
    checkOut: string;
    numberOfGuests?: number;
    specialRequests?: string;
    discountPercent?: number;
    promoCode?: string;
    status?: BookingStatus;
  }): Observable<{ success: boolean; groupId: string; count: number; data: Booking[] }> {
    return this.http.post<{ success: boolean; groupId: string; count: number; data: Booking[] }>(
      `${this.baseUrl}/bookings/group`,
      payload
    ).pipe(
      tap(() => this.bookingUpdatedSource.next())
    );
  }

  updateBooking(id: string, payload: Partial<BookingPayload & { amountPaid?: number }>): Observable<ApiResponse<Booking>> {
    return this.http.put<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}`, payload).pipe(
      tap(() => this.bookingUpdatedSource.next())
    );
  }

  confirmBooking(id: string): Observable<ApiResponse<Booking>> {
    return this.http.patch<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}/confirm`, {}).pipe(
      tap(() => this.bookingUpdatedSource.next())
    );
  }

  cancelBooking(id: string): Observable<ApiResponse<Booking>> {
    return this.http.patch<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}/cancel`, {}).pipe(
      tap(() => this.bookingUpdatedSource.next())
    );
  }

  checkIn(id: string): Observable<ApiResponse<Booking>> {
    return this.http.patch<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}/check-in`, {}).pipe(
      tap(() => this.bookingUpdatedSource.next())
    );
  }

  checkOut(id: string): Observable<ApiResponse<Booking>> {
    return this.http.patch<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}/check-out`, {}).pipe(
      tap(() => this.bookingUpdatedSource.next())
    );
  }

  deleteBooking(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/bookings/${id}`);
  }

  addPayment(
    id: string,
    payload: { amount: number; method?: string; note?: string }
  ): Observable<ApiResponse<Booking>> {
    return this.http.post<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}/payments`, payload);
  }

  changeRoom(id: string, room: string): Observable<ApiResponse<Booking>> {
    return this.http.patch<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}/change-room`, {
      room,
    });
  }

  addNote(id: string, text: string): Observable<ApiResponse<Booking>> {
    return this.http.post<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}/notes`, { text });
  }

  uploadIdDocument(id: string, file: File): Observable<ApiResponse<Booking>> {
    const form = new FormData();
    form.append('document', file);
    return this.http.post<ApiResponse<Booking>>(
      `${this.baseUrl}/bookings/${id}/id-document`,
      form
    );
  }

  notify(id: string, channel: 'email' | 'sms' = 'email'): Observable<{
    success: boolean;
    message: string;
    simulated?: boolean;
    preview?: string;
  }> {
    return this.http.post<{ success: boolean; message: string; simulated?: boolean; preview?: string }>(
      `${this.baseUrl}/bookings/${id}/notify`,
      { channel }
    );
  }

  processNoShows(): Observable<{ success: boolean; message: string; count: number }> {
    return this.http.post<{ success: boolean; message: string; count: number }>(
      `${this.baseUrl}/bookings/no-show/process`,
      {}
    );
  }

  walkIn(payload: any): Observable<ApiResponse<Booking>> {
    return this.http.post<ApiResponse<Booking>>(`${this.baseUrl}/bookings/walk-in`, payload);
  }

  getDeskToday(): Observable<DeskTodayResponse> {
    return this.http.get<DeskTodayResponse>(`${this.baseUrl}/bookings/desk/today`);
  }

  getCalendar(from: string, to: string): Observable<{
    success: boolean;
    from: string;
    to: string;
    rooms: BookingRoom[];
    bookings: Booking[];
  }> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<{
      success: boolean;
      from: string;
      to: string;
      rooms: BookingRoom[];
      bookings: Booking[];
    }>(`${this.baseUrl}/bookings/calendar`, { params });
  }

  getFolio(id: string): Observable<ApiResponse<FolioData>> {
    return this.http.get<ApiResponse<FolioData>>(`${this.baseUrl}/bookings/${id}/folio`);
  }

  getReportSummary(from?: string, to?: string): Observable<ApiResponse<ReportSummary>> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<ApiResponse<ReportSummary>>(`${this.baseUrl}/bookings/reports/summary`, {
      params,
    });
  }

  getWaitlist(status?: string): Observable<ApiResponse<WaitlistItem[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<WaitlistItem[]>>(`${this.baseUrl}/bookings/waitlist`, {
      params,
    });
  }

  createWaitlist(payload: Partial<WaitlistItem> & { guest: string }): Observable<ApiResponse<WaitlistItem>> {
    return this.http.post<ApiResponse<WaitlistItem>>(`${this.baseUrl}/bookings/waitlist`, payload);
  }

  updateWaitlist(id: string, payload: Partial<WaitlistItem>): Observable<ApiResponse<WaitlistItem>> {
    return this.http.put<ApiResponse<WaitlistItem>>(
      `${this.baseUrl}/bookings/waitlist/${id}`,
      payload
    );
  }

  deleteWaitlist(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(
      `${this.baseUrl}/bookings/waitlist/${id}`
    );
  }

  checkAvailability(checkIn: string, checkOut: string): Observable<AvailabilityResponse> {
    const params = new HttpParams().set('checkIn', checkIn).set('checkOut', checkOut);
    return this.http.get<AvailabilityResponse>(`${this.baseUrl}/bookings/availability`, { params });
  }

  getGuestHistory(guestId: string): Observable<{
    success: boolean;
    guest: BookingGuest;
    count: number;
    data: Booking[];
  }> {
    return this.http.get<{
      success: boolean;
      guest: BookingGuest;
      count: number;
      data: Booking[];
    }>(`${this.baseUrl}/bookings/guest/${guestId}`);
  }

  getGuests(): Observable<ApiResponse<BookingGuest[]>> {
    return this.http.get<ApiResponse<BookingGuest[]>>(`${this.baseUrl}/guests`);
  }

  createGuest(payload: GuestPayload): Observable<ApiResponse<BookingGuest>> {
    return this.http.post<ApiResponse<BookingGuest>>(`${this.baseUrl}/guests`, payload);
  }

  getRooms(): Observable<ApiResponse<BookingRoom[]>> {
    return this.http.get<ApiResponse<BookingRoom[]>>(`${this.baseUrl}/rooms`);
  }
}
