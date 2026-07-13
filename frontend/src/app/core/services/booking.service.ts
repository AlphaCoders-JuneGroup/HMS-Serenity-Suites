import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './api.service';

export type BookingStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Checked-In'
  | 'Checked-Out'
  | 'Cancelled';

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

export interface Booking {
  _id?: string;
  guest: BookingGuest | string;
  room: BookingRoom | string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  specialRequests?: string;
  numberOfGuests?: number;
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
  nights: number;
  count: number;
  data: BookingRoom[];
}

@Injectable({ providedIn: 'root' })
export class BookingService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getBookings(status?: string): Observable<ApiResponse<Booking[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<ApiResponse<Booking[]>>(`${this.baseUrl}/bookings`, { params });
  }

  getBookingById(id: string): Observable<ApiResponse<Booking>> {
    return this.http.get<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}`);
  }

  createBooking(payload: BookingPayload): Observable<ApiResponse<Booking>> {
    return this.http.post<ApiResponse<Booking>>(`${this.baseUrl}/bookings`, payload);
  }

  updateBooking(id: string, payload: Partial<BookingPayload>): Observable<ApiResponse<Booking>> {
    return this.http.put<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}`, payload);
  }

  confirmBooking(id: string): Observable<ApiResponse<Booking>> {
    return this.http.patch<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}/confirm`, {});
  }

  cancelBooking(id: string): Observable<ApiResponse<Booking>> {
    return this.http.patch<ApiResponse<Booking>>(`${this.baseUrl}/bookings/${id}/cancel`, {});
  }

  deleteBooking(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.baseUrl}/bookings/${id}`);
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
