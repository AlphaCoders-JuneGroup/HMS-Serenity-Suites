import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './api.service';
import { Booking } from './booking.service';

export interface GuestAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface Guest {
  _id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality?: string;
  idType?: 'Passport' | 'National ID' | 'Driving License' | '';
  idNumber?: string;
  address?: GuestAddress;
  createdAt?: string;
  updatedAt?: string;
}

export interface GuestPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality?: string;
  idType?: string;
  idNumber?: string;
  address?: GuestAddress;
}

export interface GuestProfileData {
  guest: Guest;
  bookings: Booking[];
  currentStays: Booking[];
  upcomingStays: Booking[];
  previousStays: Booking[];
  stats: {
    totalBookings: number;
    currentStays: number;
    upcomingStays: number;
    previousStays: number;
    activeReservations: number;
  };
}

@Injectable({ providedIn: 'root' })
export class GuestService {
  private apiUrl = `${environment.apiUrl}/guests`;

  constructor(private http: HttpClient) {}

  getGuests(search?: string): Observable<ApiResponse<Guest[]>> {
    let params = new HttpParams();
    if (search?.trim()) params = params.set('search', search.trim());
    return this.http.get<ApiResponse<Guest[]>>(this.apiUrl, { params });
  }

  getGuestById(id: string): Observable<ApiResponse<Guest>> {
    return this.http.get<ApiResponse<Guest>>(`${this.apiUrl}/${id}`);
  }

  getGuestProfile(id: string): Observable<ApiResponse<GuestProfileData>> {
    return this.http.get<ApiResponse<GuestProfileData>>(`${this.apiUrl}/${id}/profile`);
  }

  createGuest(payload: GuestPayload): Observable<ApiResponse<Guest>> {
    return this.http.post<ApiResponse<Guest>>(this.apiUrl, payload);
  }

  updateGuest(id: string, payload: Partial<GuestPayload>): Observable<ApiResponse<Guest>> {
    return this.http.put<ApiResponse<Guest>>(`${this.apiUrl}/${id}`, payload);
  }

  deleteGuest(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }
}
