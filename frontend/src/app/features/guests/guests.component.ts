import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

export interface Guest {
  _id?: string;
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
    state?: string;
    country?: string;
    zipCode?: string;
  };
}

@Component({
  selector: 'app-guests',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './guests.component.html',
  styleUrl: './guests.component.scss',
})
export class GuestsComponent implements OnInit {
  guests: Guest[] = [];
  filteredGuests: Guest[] = [];
  loading = true;
  error = '';
  searchTerm = '';

  get withIdCount(): number {
    return this.guests.filter((g) => !!g.idType).length;
  }

  get nationalityCount(): number {
    return new Set(this.guests.map((g) => g.nationality).filter(Boolean)).size;
  }

  get localCount(): number {
    return this.guests.filter((g) =>
      (g.nationality || '').toLowerCase().includes('sri') ||
      (g.address?.country || '').toLowerCase().includes('sri')
    ).length;
  }

  constructor(private api: ApiService) {}

  applyFilters(): void {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) {
      this.filteredGuests = this.guests;
      return;
    }
    this.filteredGuests = this.guests.filter((g) => {
      const name = `${g.firstName} ${g.lastName}`.toLowerCase();
      return (
        name.includes(q) ||
        g.email?.toLowerCase().includes(q) ||
        g.phone?.includes(q) ||
        g.nationality?.toLowerCase().includes(q)
      );
    });
  }

  location(guest: Guest): string {
    const parts = [guest.address?.city, guest.address?.country].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  ngOnInit(): void {
    this.api.getGuests().subscribe({
      next: (res) => {
        this.guests = (res.data ?? []) as Guest[];
        this.filteredGuests = this.guests;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load guests';
        this.loading = false;
      },
    });
  }
}
