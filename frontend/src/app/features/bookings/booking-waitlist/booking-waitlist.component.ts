import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BookingGuest,
  BookingService,
  WaitlistItem,
} from '../../../core/services/booking.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-booking-waitlist',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './booking-waitlist.component.html',
})
export class BookingWaitlistComponent implements OnInit {
  items: WaitlistItem[] = [];
  guests: BookingGuest[] = [];
  loading = true;
  error = '';
  success = '';
  showForm = false;

  form = {
    guest: '',
    preferredType: 'Any',
    checkIn: '',
    checkOut: '',
    numberOfGuests: 1,
    notes: '',
  };

  roomTypes = ['Any', 'Standard', 'Deluxe', 'Suite', 'Presidential'];

  constructor(
    private bookingService: BookingService,
    private auth: AuthService
  ) {}

  get canManage(): boolean {
    return this.auth.hasRole('Admin', 'Receptionist');
  }

  ngOnInit(): void {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);
    this.form.checkIn = tomorrow.toISOString().slice(0, 10) + 'T14:00';
    this.form.checkOut = dayAfter.toISOString().slice(0, 10) + 'T12:00';
    this.load();
    this.bookingService.getGuests().subscribe({ next: (r) => (this.guests = r.data ?? []) });
  }

  load(): void {
    this.loading = true;
    this.bookingService.getWaitlist().subscribe({
      next: (res) => {
        this.items = res.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load waitlist';
        this.loading = false;
      },
    });
  }

  guestName(item: WaitlistItem): string {
    if (!item.guest || typeof item.guest === 'string') return 'Guest';
    return `${item.guest.firstName} ${item.guest.lastName}`;
  }

  create(): void {
    if (!this.form.guest) {
      this.error = 'Select a guest.';
      return;
    }
    this.bookingService
      .createWaitlist({
        guest: this.form.guest,
        preferredType: this.form.preferredType,
        checkIn: this.form.checkIn,
        checkOut: this.form.checkOut,
        numberOfGuests: this.form.numberOfGuests,
        notes: this.form.notes,
      })
      .subscribe({
        next: () => {
          this.success = 'Added to waitlist.';
          this.showForm = false;
          this.load();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to add';
        },
      });
  }

  setStatus(item: WaitlistItem, status: WaitlistItem['status']): void {
    if (!item._id) return;
    this.bookingService.updateWaitlist(item._id, { status }).subscribe({
      next: () => {
        this.success = `Marked as ${status}.`;
        this.load();
      },
      error: (err) => {
        this.error = err.error?.message || 'Update failed';
      },
    });
  }

  remove(item: WaitlistItem): void {
    if (!item._id || !confirm('Remove waitlist entry?')) return;
    this.bookingService.deleteWaitlist(item._id).subscribe({
      next: () => this.load(),
      error: (err) => (this.error = err.error?.message || 'Delete failed'),
    });
  }
}
