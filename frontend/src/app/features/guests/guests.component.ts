import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Guest, GuestListResponse, GuestService } from '../../core/services/guest.service';

@Component({
  selector: 'app-guests',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './guests.component.html',
  styleUrl: './guests.component.scss',
})
export class GuestsComponent implements OnInit {
  guests: Guest[] = [];
  loading = true;
  error = '';
  success = '';
  searchTerm = '';
  loyaltyFilter = '';
  blacklistFilter = '';
  showArchived = false;
  page = 1;
  pages = 1;
  total = 0;
  limit = 25;
  deleteConfirmId = '';
  mergePrimary = '';
  mergeSecondary = '';
  showMerge = false;
  birthdays: Guest[] = [];
  anniversaries: Guest[] = [];

  constructor(
    private guestService: GuestService,
    private auth: AuthService
  ) {}

  get canManageGuests(): boolean {
    return this.auth.hasRole('Admin', 'Receptionist');
  }

  get vipCount(): number {
    return this.guests.filter((g) => g.loyaltyTier === 'VIP').length;
  }

  get blacklistCount(): number {
    return this.guests.filter((g) => g.isBlacklisted).length;
  }

  get corporateCount(): number {
    return this.guests.filter((g) => g.loyaltyTier === 'Corporate').length;
  }

  loadGuests(): void {
    this.loading = true;
    this.guestService
      .getGuests({
        search: this.searchTerm || undefined,
        loyaltyTier: this.loyaltyFilter || undefined,
        isBlacklisted: this.blacklistFilter || undefined,
        includeArchived: undefined,
        isArchived: this.showArchived ? 'true' : undefined,
        page: this.page,
        limit: this.limit,
      })
      .subscribe({
        next: (res) => {
          const r = res as GuestListResponse;
          this.guests = r.data ?? [];
          this.total = r.total ?? this.guests.length;
          this.page = r.page ?? 1;
          this.pages = r.pages ?? 1;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to load guests';
          this.loading = false;
        },
      });
  }

  search(): void {
    this.page = 1;
    this.loadGuests();
  }

  goPage(p: number): void {
    if (p < 1 || p > this.pages) return;
    this.page = p;
    this.loadGuests();
  }

  location(guest: Guest): string {
    const parts = [guest.address?.city, guest.address?.country].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  tierClass(tier?: string): string {
    switch (tier) {
      case 'VIP':
        return 'badge-success';
      case 'Corporate':
        return 'badge-info';
      default:
        return 'badge-neutral';
    }
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
        this.success = res.message || 'Guest archived.';
        this.deleteConfirmId = '';
        this.loadGuests();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to archive guest';
        this.deleteConfirmId = '';
      },
    });
  }

  restoreGuest(guest: Guest): void {
    if (!guest._id) return;
    this.guestService.updateGuest(guest._id, { isArchived: false }).subscribe({
      next: () => {
        this.success = 'Guest restored.';
        this.loadGuests();
      },
      error: (err) => (this.error = err.error?.message || 'Restore failed'),
    });
  }

  exportCsv(): void {
    this.guestService.exportCsv().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'guests.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.success = 'CSV exported.';
      },
      error: () => (this.error = 'Export failed'),
    });
  }

  submitMerge(): void {
    if (!this.mergePrimary || !this.mergeSecondary) {
      this.error = 'Select primary and secondary guests.';
      return;
    }
    this.guestService.merge(this.mergePrimary, this.mergeSecondary).subscribe({
      next: () => {
        this.success = 'Guests merged.';
        this.showMerge = false;
        this.loadGuests();
      },
      error: (err) => (this.error = err.error?.message || 'Merge failed'),
    });
  }

  loadReminders(): void {
    this.guestService.getReminders().subscribe({
      next: (res) => {
        this.birthdays = res.data?.birthdays ?? [];
        this.anniversaries = res.data?.anniversaries ?? [];
      },
    });
  }

  ngOnInit(): void {
    this.loadGuests();
    this.loadReminders();
  }
}
