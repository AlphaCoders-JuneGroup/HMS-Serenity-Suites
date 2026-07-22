import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  Guest,
  GuestProfileData,
  GuestService,
} from '../../../core/services/guest.service';
import { Booking } from '../../../core/services/booking.service';

@Component({
  selector: 'app-guest-profile',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './guest-profile.component.html',
})
export class GuestProfileComponent implements OnInit {
  profile: GuestProfileData | null = null;
  loading = true;
  error = '';
  success = '';
  guestId = '';
  noteText = '';
  folio: any = null;
  showFolio = false;

  constructor(
    private route: ActivatedRoute,
    private guestService: GuestService,
    private auth: AuthService
  ) {}

  get canManage(): boolean {
    return this.auth.hasRole('Admin', 'Receptionist');
  }

  get guest(): Guest | null {
    return this.profile?.guest ?? null;
  }

  photoUrl(): string | null {
    return this.guestService.assetUrl(this.guest?.photo?.path);
  }

  docUrl(path?: string): string | null {
    return this.guestService.assetUrl(path);
  }

  location(guest: Guest): string {
    const parts = [
      guest.address?.street,
      guest.address?.city,
      guest.address?.state,
      guest.address?.country,
      guest.address?.zipCode,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  roomLabel(booking: Booking): string {
    if (!booking.room || typeof booking.room === 'string') return 'Unassigned';
    return booking.room.roomNumber
      ? `Room ${booking.room.roomNumber}${booking.room.type ? ' · ' + booking.room.type : ''}`
      : 'Unassigned';
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Confirmed':
        return 'badge-info';
      case 'Checked-In':
        return 'badge-success';
      case 'Checked-Out':
        return 'badge-neutral';
      case 'Cancelled':
      case 'No-Show':
        return 'badge-danger';
      default:
        return 'badge-warning';
    }
  }

  reload(): void {
    this.guestService.getGuestProfile(this.guestId).subscribe({
      next: (res) => {
        this.profile = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load profile';
        this.loading = false;
      },
    });
  }

  addNote(): void {
    if (!this.noteText.trim()) return;
    this.guestService.addNote(this.guestId, this.noteText.trim()).subscribe({
      next: (res) => {
        if (this.profile) this.profile.guest = res.data;
        this.noteText = '';
        this.success = 'Note added.';
      },
      error: (err) => (this.error = err.error?.message || 'Failed to add note'),
    });
  }

  onDocUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.guestService.uploadDocument(this.guestId, file).subscribe({
      next: (res) => {
        if (this.profile) this.profile.guest = res.data;
        this.success = 'Document uploaded.';
      },
      error: (err) => (this.error = err.error?.message || 'Upload failed'),
    });
  }

  onPhotoUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.guestService.uploadPhoto(this.guestId, file).subscribe({
      next: (res) => {
        if (this.profile) this.profile.guest = res.data;
        this.success = 'Photo uploaded.';
      },
      error: (err) => (this.error = err.error?.message || 'Photo upload failed'),
    });
  }

  notify(): void {
    this.guestService
      .notify(this.guestId, {
        channel: 'email',
        subject: 'Hello from Serenity Suites',
        message: `Dear ${this.guest?.firstName}, thank you for being our valued guest.`,
      })
      .subscribe({
        next: (res) => {
          if (this.profile) this.profile.guest = res.data;
          this.success = 'Message simulated and logged.';
        },
        error: (err) => (this.error = err.error?.message || 'Notify failed'),
      });
  }

  loadFolio(): void {
    this.guestService.getFolioHistory(this.guestId).subscribe({
      next: (res) => {
        this.folio = res.data;
        this.showFolio = true;
      },
      error: (err) => (this.error = err.error?.message || 'Failed to load folio'),
    });
  }

  printFolio(): void {
    window.print();
  }

  ngOnInit(): void {
    this.guestId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.guestId) {
      this.error = 'Guest not found';
      this.loading = false;
      return;
    }
    this.reload();
  }
}
