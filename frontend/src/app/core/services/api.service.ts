import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T> {
  success: boolean;
  count?: number;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getHealth(): Observable<{ status: string; message: string }> {
    return this.http.get<{ status: string; message: string }>(`${this.baseUrl}/health`);
  }

  getRooms(): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.baseUrl}/rooms`);
  }

  createRoom(payload: unknown): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/rooms`, payload);
  }

  updateRoom(id: string, payload: unknown): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.baseUrl}/rooms/${id}`, payload);
  }

  deleteRoom(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/rooms/${id}`);
  }

  getRoomTypes(): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.baseUrl}/room-types`);
  }

  createRoomType(payload: unknown): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.baseUrl}/room-types`, payload);
  }

  updateRoomType(id: string, payload: unknown): Observable<ApiResponse<unknown>> {
    return this.http.put<ApiResponse<unknown>>(`${this.baseUrl}/room-types/${id}`, payload);
  }

  deleteRoomType(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/room-types/${id}`);
  }

  checkRoomAvailability(checkIn: string, checkOut: string): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.baseUrl}/bookings/availability`, {
      params: { checkIn, checkOut }
    });
  }

  getGuests(): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.baseUrl}/guests`);
  }

  getBookings(): Observable<ApiResponse<unknown[]>> {
    return this.http.get<ApiResponse<unknown[]>>(`${this.baseUrl}/bookings`);
  }
}
