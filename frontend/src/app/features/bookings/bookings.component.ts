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
  receiptBooking: Booking | null = null;
  showReceipt = false;

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

  canShowReceipt(booking: Booking): boolean {
    return booking.paymentStatus === 'Paid' && booking.status !== 'Cancelled';
  }

  canMarkPaid(booking: Booking): boolean {
    return (
      this.canManageBookings &&
      booking.status !== 'Cancelled' &&
      booking.paymentStatus !== 'Paid'
    );
  }

  nights(booking: Booking): number {
    const start = new Date(booking.checkIn);
    const end = new Date(booking.checkOut);
    const ms = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
    return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
  }

  guestEmail(booking: Booking): string {
    if (!booking.guest || typeof booking.guest === 'string') return '—';
    return booking.guest.email || '—';
  }

  guestPhone(booking: Booking): string {
    if (!booking.guest || typeof booking.guest === 'string') return '—';
    return booking.guest.phone || '—';
  }

  roomType(booking: Booking): string {
    if (!booking.room || typeof booking.room === 'string') return '—';
    return booking.room.type || '—';
  }

  roomNumber(booking: Booking): string {
    if (!booking.room || typeof booking.room === 'string') return '—';
    return booking.room.roomNumber || '—';
  }

  receiptId(booking: Booking): string {
    return (booking._id || '').slice(-8).toUpperCase() || 'N/A';
  }

  openReceipt(booking: Booking): void {
    if (!this.canShowReceipt(booking)) {
      this.error = 'Receipt is available only after full payment is completed.';
      return;
    }
    this.receiptBooking = booking;
    this.showReceipt = true;
  }

  closeReceipt(): void {
    this.showReceipt = false;
    this.receiptBooking = null;
  }

  printReceipt(): void {
    window.print();
  }

  /** Mark full payment as Paid, then generate receipt */
  markPaidAndGenerateReceipt(booking: Booking): void {
    if (!booking._id || !this.canMarkPaid(booking)) return;
    this.actionLoadingId = booking._id;
    this.error = '';
    this.bookingService.updateBooking(booking._id, { paymentStatus: 'Paid' }).subscribe({
      next: (res) => {
        this.replaceBooking(res.data);
        this.success = 'Full payment recorded. Receipt generated.';
        this.actionLoadingId = '';
        this.openReceipt(res.data);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to record payment';
        this.actionLoadingId = '';
      },
    });
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
