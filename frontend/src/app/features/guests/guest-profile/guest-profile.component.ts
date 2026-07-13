import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
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
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './guest-profile.component.html',
})
export class GuestProfileComponent implements OnInit {
  profile: GuestProfileData | null = null;
  loading = true;
  error = '';
  guestId = '';

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
        return 'badge-danger';
      default:
        return 'badge-warning';
    }
  }

  ngOnInit(): void {
    this.guestId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.guestId) {
      this.error = 'Guest not found';
      this.loading = false;
      return;
    }

    this.guestService.getGuestProfile(this.guestId).subscribe({
      next: (res) => {
        this.profile = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load guest profile';
        this.loading = false;
      },
    });
  }
}
