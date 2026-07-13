import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Booking,
  BookingService,
  BookingStatus,
} from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent implements OnInit {
  bookings: Booking[] = [];
  filteredBookings: Booking[] = [];
  loading = true;
  error = '';
  success = '';
  filterStatus = '';
  actionLoadingId = '';

  statuses: BookingStatus[] = [
    'Pending',
    'Confirmed',
    'Checked-In',
    'Checked-Out',
    'Cancelled',
  ];

  constructor(
    private bookingService: BookingService,
    private auth: AuthService
  ) {}

  /** Manager can view only; Admin & Receptionist can manage */
  get canManageBookings(): boolean {
    return this.auth.hasRole('Admin', 'Receptionist');
  }

  get confirmedCount(): number {
    return this.bookings.filter((b) => b.status === 'Confirmed').length;
  }

  get checkedInCount(): number {
    return this.bookings.filter((b) => b.status === 'Checked-In').length;
  }

  get pendingCount(): number {
    return this.bookings.filter((b) => b.status === 'Pending').length;
  }

  get pendingPaymentCount(): number {
    return this.bookings.filter(
      (b) => b.paymentStatus === 'Pending' || b.paymentStatus === 'Partial'
    ).length;
  }

  get totalRevenue(): number {
    return this.bookings
      .filter((b) => b.status !== 'Cancelled')
      .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  }

  applyFilters(): void {
    if (!this.filterStatus) {
      this.filteredBookings = this.bookings;
      return;
    }
    this.filteredBookings = this.bookings.filter((b) => b.status === this.filterStatus);
  }

  guestName(booking: Booking): string {
    if (!booking.guest || typeof booking.guest === 'string') return 'Unknown guest';
    return `${booking.guest.firstName || ''} ${booking.guest.lastName || ''}`.trim() || 'Unknown guest';
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

  paymentClass(status: string): string {
    switch (status) {
      case 'Paid':
        return 'badge-success';
      case 'Partial':
        return 'badge-warning';
      case 'Refunded':
        return 'badge-neutral';
      default:
        return 'badge-danger';
    }
  }

  canConfirm(booking: Booking): boolean {
    return this.canManageBookings && booking.status === 'Pending';
  }

  canCancel(booking: Booking): boolean {
    return this.canManageBookings && (booking.status === 'Pending' || booking.status === 'Confirmed');
  }

  canEdit(booking: Booking): boolean {
    return this.canManageBookings && !['Checked-Out', 'Cancelled'].includes(booking.status);
  }

  confirm(booking: Booking): void {
    if (!booking._id || !this.canManageBookings) return;
    this.actionLoadingId = booking._id;
    this.error = '';
    this.bookingService.confirmBooking(booking._id).subscribe({
      next: (res) => {
        this.replaceBooking(res.data);
        this.success = 'Booking confirmed.';
        this.actionLoadingId = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to confirm booking';
        this.actionLoadingId = '';
      },
    });
  }

  cancel(booking: Booking): void {
    if (!booking._id || !this.canManageBookings) return;
    if (!confirm(`Cancel booking for ${this.guestName(booking)}?`)) return;

    this.actionLoadingId = booking._id;
    this.error = '';
    this.bookingService.cancelBooking(booking._id).subscribe({
      next: (res) => {
        this.replaceBooking(res.data);
        this.success = 'Booking cancelled.';
        this.actionLoadingId = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to cancel booking';
        this.actionLoadingId = '';
      },
    });
  }

  private replaceBooking(updated: Booking): void {
    this.bookings = this.bookings.map((b) => (b._id === updated._id ? updated : b));
    this.applyFilters();
  }

  loadBookings(): void {
    this.loading = true;
    this.bookingService.getBookings().subscribe({
      next: (res) => {
        this.bookings = res.data ?? [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to load bookings';
        this.loading = false;
      },
    });
  }

  ngOnInit(): void {
    this.loadBookings();
  }
}
