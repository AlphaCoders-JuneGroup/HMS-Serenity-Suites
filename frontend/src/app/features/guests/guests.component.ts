import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Guest, GuestService } from '../../core/services/guest.service';

@Component({
  selector: 'app-guests',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './guests.component.html',
  styleUrl: './guests.component.scss',
})
export class GuestsComponent implements OnInit {
  guests: Guest[] = [];
  filteredGuests: Guest[] = [];
  loading = true;
  error = '';
  success = '';
  searchTerm = '';
  deleteConfirmId = '';

  constructor(
    private guestService: GuestService,
    private auth: AuthService
  ) {}

  get canManageGuests(): boolean {
    return this.auth.hasRole('Admin', 'Receptionist');
  }

  get withIdCount(): number {
    return this.guests.filter((g) => !!g.idType).length;
  }

  get nationalityCount(): number {
    return new Set(this.guests.map((g) => g.nationality).filter(Boolean)).size;
  }

  get localCount(): number {
    return this.guests.filter(
      (g) =>
        (g.nationality || '').toLowerCase().includes('sri') ||
        (g.address?.country || '').toLowerCase().includes('sri')
    ).length;
  }

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
        g.nationality?.toLowerCase().includes(q) ||
        g.idNumber?.toLowerCase().includes(q)
      );
    });
  }

  location(guest: Guest): string {
    const parts = [guest.address?.city, guest.address?.country].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  confirmDelete(id: string): void {
    this.deleteConfirmId = id;
  }

  cancelDelete(): void {
    this.deleteConfirmId = '';
  }

  deleteGuest(id: string): void {
    if (!this.canManageGuests) return;
    this.guestService.deleteGuest(id).subscribe({
      next: (res) => {
        this.guests = this.guests.filter((g) => g._id !== id);
        this.applyFilters();
        this.success = res.message || 'Guest deleted.';
        this.deleteConfirmId = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete guest';
        this.deleteConfirmId = '';
      },
    });
  }

  loadGuests(): void {
    this.loading = true;
    this.guestService.getGuests().subscribe({
      next: (res) => {
        this.guests = res.data ?? [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to load guests';
        this.loading = false;
      },
    });
  }

  ngOnInit(): void {
    this.loadGuests();
  }
}
