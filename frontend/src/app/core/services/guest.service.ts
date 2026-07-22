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

export interface GuestPreferences {
  preferredRoomType?: string;
  pillowType?: string;
  dietaryNeeds?: string;
  specialNeeds?: string;
  other?: string;
}

export interface GuestNote {
  _id?: string;
  text: string;
  authorName?: string;
  at?: string;
}

export interface GuestDocument {
  _id?: string;
  originalName?: string;
  path?: string;
  mimeType?: string;
  label?: string;
  uploadedAt?: string;
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
  loyaltyTier?: 'Regular' | 'VIP' | 'Corporate';
  preferences?: GuestPreferences;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  company?: { name?: string; billingEmail?: string; taxId?: string };
  isArchived?: boolean;
  marketingOptIn?: boolean;
  dataProcessingConsent?: boolean;
  dateOfBirth?: string;
  anniversary?: string;
  photo?: { path?: string; originalName?: string };
  notes?: GuestNote[];
  documents?: GuestDocument[];
  communications?: Array<{
    channel?: string;
    subject?: string;
    message?: string;
    at?: string;
    sentBy?: string;
  }>;
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
  loyaltyTier?: string;
  preferences?: GuestPreferences;
  isBlacklisted?: boolean;
  blacklistReason?: string;
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  company?: { name?: string; billingEmail?: string; taxId?: string };
  isArchived?: boolean;
  marketingOptIn?: boolean;
  dataProcessingConsent?: boolean;
  dateOfBirth?: string | null;
  anniversary?: string | null;
}

export interface GuestListParams {
  search?: string;
  q?: string;
  loyaltyTier?: string;
  isBlacklisted?: string;
  isArchived?: string;
  includeArchived?: string;
  page?: number;
  limit?: number;
}

export interface GuestListResponse {
  success: boolean;
  count: number;
  total: number;
  page: number;
  pages: number;
  data: Guest[];
}

export interface GuestProfileData {
  guest: Guest;
  bookings: Booking[];
  currentStays: Booking[];
  upcomingStays: Booking[];
  previousStays: Booking[];
  stats: {
    totalBookings: number;
    totalStays?: number;
    currentStays: number;
    upcomingStays: number;
    previousStays: number;
    activeReservations: number;
    totalSpend?: number;
    restaurantTotal?: number;
    grandSpend?: number;
    lastVisit?: string | null;
    isRepeatGuest?: boolean;
  };
}

@Injectable({ providedIn: 'root' })
export class GuestService {
  private apiUrl = `${environment.apiUrl}/guests`;

  constructor(private http: HttpClient) {}

  getGuests(params?: GuestListParams | string): Observable<GuestListResponse | ApiResponse<Guest[]>> {
    let httpParams = new HttpParams();
    if (typeof params === 'string') {
      if (params.trim()) httpParams = httpParams.set('search', params.trim());
    } else if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') httpParams = httpParams.set(k, String(v));
      });
    }
    return this.http.get<GuestListResponse>(this.apiUrl, { params: httpParams });
  }

  getGuestById(id: string): Observable<ApiResponse<Guest>> {
    return this.http.get<ApiResponse<Guest>>(`${this.apiUrl}/${id}`);
  }

  getGuestProfile(id: string): Observable<ApiResponse<GuestProfileData>> {
    return this.http.get<ApiResponse<GuestProfileData>>(`${this.apiUrl}/${id}/profile`);
  }

  getFolioHistory(id: string): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/${id}/folio-history`);
  }

  getReminders(): Observable<ApiResponse<{ birthdays: Guest[]; anniversaries: Guest[] }>> {
    return this.http.get<ApiResponse<{ birthdays: Guest[]; anniversaries: Guest[] }>>(
      `${this.apiUrl}/reminders`
    );
  }

  exportCsv(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export`, { responseType: 'blob' });
  }

  createGuest(payload: GuestPayload): Observable<ApiResponse<Guest>> {
    return this.http.post<ApiResponse<Guest>>(this.apiUrl, payload);
  }

  updateGuest(id: string, payload: Partial<GuestPayload>): Observable<ApiResponse<Guest>> {
    return this.http.put<ApiResponse<Guest>>(`${this.apiUrl}/${id}`, payload);
  }

  deleteGuest(id: string, hard = false): Observable<{ success: boolean; message: string }> {
    const params = hard ? new HttpParams().set('soft', 'false') : undefined;
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`, {
      params,
    });
  }

  addNote(id: string, text: string): Observable<ApiResponse<Guest>> {
    return this.http.post<ApiResponse<Guest>>(`${this.apiUrl}/${id}/notes`, { text });
  }

  uploadDocument(id: string, file: File, label = 'ID'): Observable<ApiResponse<Guest>> {
    const form = new FormData();
    form.append('document', file);
    form.append('label', label);
    return this.http.post<ApiResponse<Guest>>(`${this.apiUrl}/${id}/documents`, form);
  }

  uploadPhoto(id: string, file: File): Observable<ApiResponse<Guest>> {
    const form = new FormData();
    form.append('photo', file);
    return this.http.post<ApiResponse<Guest>>(`${this.apiUrl}/${id}/photo`, form);
  }

  notify(id: string, payload: { channel?: string; subject?: string; message?: string }): Observable<ApiResponse<Guest>> {
    return this.http.post<ApiResponse<Guest>>(`${this.apiUrl}/${id}/notify`, payload);
  }

  merge(primaryId: string, secondaryId: string): Observable<ApiResponse<Guest>> {
    return this.http.post<ApiResponse<Guest>>(`${this.apiUrl}/merge`, { primaryId, secondaryId });
  }

  assetUrl(path?: string): string | null {
    if (!path) return null;
    const base = environment.apiUrl.replace(/\/api$/, '');
    return `${base}${path}`;
  }
}
