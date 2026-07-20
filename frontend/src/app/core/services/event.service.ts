import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './api.service';

export type EventStatus = 'Inquiry' | 'Confirmed' | 'Ongoing' | 'Completed' | 'Cancelled';
export type EventPaymentStatus = 'Pending' | 'Partial' | 'Paid' | 'Refunded';
export type EventType =
  | 'Wedding'
  | 'Conference'
  | 'Corporate Meeting'
  | 'Birthday Party'
  | 'Seminar'
  | 'Exhibition'
  | 'Other';

export interface EventHall {
  _id?: string;
  name: string;
  type: 'Banquet Hall' | 'Conference Room' | 'Meeting Room' | 'Garden / Outdoor' | 'Rooftop';
  capacity: number;
  ratePerHour: number;
  ratePerDay?: number;
  amenities?: string[];
  description?: string;
  image?: string;
  isActive?: boolean;
}

export interface EventService_ {
  _id?: string;
  name: string;
  price: number;
  quantity: number;
}

export interface EventPayment {
  _id?: string;
  amount: number;
  method?: string;
  note?: string;
  at?: string;
}

export interface EventNote {
  _id?: string;
  text: string;
  authorName?: string;
  at?: string;
}

export interface HotelEvent {
  _id?: string;
  eventTitle: string;
  eventType: EventType;
  hall: EventHall | string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  organization?: string;
  guest?: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  expectedGuests: number;
  status: EventStatus;
  services: EventService_[];
  hallCharge?: number;
  servicesTotal?: number;
  discountPercent?: number;
  taxPercent?: number;
  totalAmount?: number;
  amountPaid?: number;
  payments?: EventPayment[];
  paymentStatus?: EventPaymentStatus;
  specialRequests?: string;
  notes?: EventNote[];
  createdAt?: string;
}

export interface EventFilters {
  status?: string;
  hall?: string;
  paymentStatus?: string;
  eventType?: string;
  from?: string;
  to?: string;
  q?: string;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private baseUrl = `${environment.apiUrl}/events`;

  constructor(private http: HttpClient) {}

  // ── Events ──────────────────────────────────────────────────────────────
  getAllEvents(filters: EventFilters = {}): Observable<ApiResponse<HotelEvent[]>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params = params.set(k, v);
    });
    return this.http.get<ApiResponse<HotelEvent[]>>(this.baseUrl, { params });
  }

  getEventById(id: string): Observable<ApiResponse<HotelEvent>> {
    return this.http.get<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}`);
  }

  createEvent(payload: Partial<HotelEvent>): Observable<ApiResponse<HotelEvent>> {
    return this.http.post<ApiResponse<HotelEvent>>(this.baseUrl, payload);
  }

  updateEvent(id: string, payload: Partial<HotelEvent>): Observable<ApiResponse<HotelEvent>> {
    return this.http.put<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}`, payload);
  }

  deleteEvent(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/${id}`);
  }

  checkHallAvailability(
    eventDate: string,
    startTime: string,
    endTime: string
  ): Observable<ApiResponse<EventHall[]>> {
    const params = new HttpParams()
      .set('eventDate', eventDate)
      .set('startTime', startTime)
      .set('endTime', endTime);
    return this.http.get<ApiResponse<EventHall[]>>(`${this.baseUrl}/availability`, { params });
  }

  getCalendar(from?: string, to?: string): Observable<ApiResponse<HotelEvent[]>> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<ApiResponse<HotelEvent[]>>(`${this.baseUrl}/calendar`, { params });
  }

  getReportsSummary(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/reports/summary`);
  }

  // ── Status transitions ──────────────────────────────────────────────────
  confirmEvent(id: string): Observable<ApiResponse<HotelEvent>> {
    return this.http.patch<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}/confirm`, {});
  }

  startEvent(id: string): Observable<ApiResponse<HotelEvent>> {
    return this.http.patch<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}/start`, {});
  }

  completeEvent(id: string): Observable<ApiResponse<HotelEvent>> {
    return this.http.patch<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}/complete`, {});
  }

  cancelEvent(id: string, reason?: string): Observable<ApiResponse<HotelEvent>> {
    return this.http.patch<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}/cancel`, { reason });
  }

  // ── Services / add-ons ───────────────────────────────────────────────────
  addService(id: string, service: { name: string; price: number; quantity: number }): Observable<ApiResponse<HotelEvent>> {
    return this.http.post<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}/services`, service);
  }

  removeService(id: string, serviceId: string): Observable<ApiResponse<HotelEvent>> {
    return this.http.delete<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}/services/${serviceId}`);
  }

  // ── Payments & notes ─────────────────────────────────────────────────────
  addPayment(
    id: string,
    payment: { amount: number; method?: string; note?: string }
  ): Observable<ApiResponse<HotelEvent>> {
    return this.http.post<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}/payments`, payment);
  }

  addNote(id: string, text: string): Observable<ApiResponse<HotelEvent>> {
    return this.http.post<ApiResponse<HotelEvent>>(`${this.baseUrl}/${id}/notes`, { text });
  }

  // ── Hall catalog ─────────────────────────────────────────────────────────
  getAllHalls(activeOnly = false): Observable<ApiResponse<EventHall[]>> {
    let params = new HttpParams();
    if (activeOnly) params = params.set('activeOnly', 'true');
    return this.http.get<ApiResponse<EventHall[]>>(`${this.baseUrl}/halls`, { params });
  }

  createHall(payload: Partial<EventHall>): Observable<ApiResponse<EventHall>> {
    return this.http.post<ApiResponse<EventHall>>(`${this.baseUrl}/halls`, payload);
  }

  updateHall(id: string, payload: Partial<EventHall>): Observable<ApiResponse<EventHall>> {
    return this.http.put<ApiResponse<EventHall>>(`${this.baseUrl}/halls/${id}`, payload);
  }

  deleteHall(id: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`${this.baseUrl}/halls/${id}`);
  }
}
