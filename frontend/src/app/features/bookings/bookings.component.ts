import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Booking,
  BookingRoom,
  BookingService,
  BookingStatus,
  FolioData,
  PaymentStatus,
} from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

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
  rooms: BookingRoom[] = [];
  loading = true;
  error = '';
  success = '';
  filterStatus = '';
  filterPayment = '';
  searchQ = '';
  filterFrom = '';
  filterTo = '';
  actionLoadingId = '';
  receiptBooking: Booking | null = null;
  showReceipt = false;

  // Modals
  paymentBooking: Booking | null = null;
  paymentAmount = 0;
  paymentMethod = 'Cash';
  paymentNote = '';

  roomChangeBooking: Booking | null = null;
  newRoomId = '';

  notesBooking: Booking | null = null;
  noteText = '';

  folio: FolioData | null = null;
  showFolio = false;

  statuses: BookingStatus[] = [
    'Pending',
    'Confirmed',
    'Checked-In',
    'Checked-Out',
    'Cancelled',
    'No-Show',
  ];
  paymentStatuses: PaymentStatus[] = ['Pending', 'Paid', 'Partial', 'Refunded'];

  constructor(
    private bookingService: BookingService,
    private auth: AuthService
  ) {}

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
      .filter((b) => b.status !== 'Cancelled' && b.status !== 'No-Show')
      .reduce((sum, b) => sum + (b.amountPaid || 0), 0);
  }

  applyFilters(): void {
    let list = [...this.bookings];
    if (this.filterStatus) list = list.filter((b) => b.status === this.filterStatus);
    if (this.filterPayment) list = list.filter((b) => b.paymentStatus === this.filterPayment);
    this.filteredBookings = list;
  }

  search(): void {
    this.loading = true;
    this.error = '';
    this.bookingService
      .getBookings({
        status: this.filterStatus || undefined,
        paymentStatus: this.filterPayment || undefined,
        q: this.searchQ || undefined,
        from: this.filterFrom || undefined,
        to: this.filterTo || undefined,
      })
      .subscribe({
        next: (res) => {
          this.bookings = res.data ?? [];
          this.applyFilters();
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to search bookings';
          this.loading = false;
        },
      });
  }

  guestId(booking: Booking): string | null {
    if (!booking.guest) return null;
    return typeof booking.guest === 'string' ? booking.guest : booking.guest._id || null;
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

  balance(booking: Booking): number {
    return Math.max(0, (booking.totalAmount || 0) - (booking.amountPaid || 0));
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
    return this.canManageBookings && !['Checked-Out', 'Cancelled', 'No-Show'].includes(booking.status);
  }

  canShowReceipt(booking: Booking): boolean {
    return booking.paymentStatus === 'Paid' && !['Cancelled', 'No-Show'].includes(booking.status);
  }

  canMarkPaid(booking: Booking): boolean {
    return (
      this.canManageBookings &&
      !['Cancelled', 'No-Show'].includes(booking.status) &&
      booking.paymentStatus !== 'Paid'
    );
  }

  nights(booking: Booking): number {
    const start = new Date(booking.checkIn);
    const end = new Date(booking.checkOut);
    const ms = end.getTime() - start.getTime();
    if (ms <= 0) return 1;
    return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  stayHours(booking: Booking): number {
    const start = new Date(booking.checkIn);
    const end = new Date(booking.checkOut);
    const ms = end.getTime() - start.getTime();
    if (ms <= 0) return 0;
    return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
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

  idDocUrl(booking: Booking): string | null {
    if (!booking.idDocument?.path) return null;
    const base = environment.apiUrl.replace(/\/api$/, '');
    return `${base}${booking.idDocument.path}`;
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

  markPaidAndGenerateReceipt(booking: Booking): void {
    if (!booking._id || !this.canMarkPaid(booking)) return;
    const due = this.balance(booking) || booking.totalAmount;
    this.actionLoadingId = booking._id;
    this.error = '';
    this.bookingService.addPayment(booking._id, { amount: due, method: 'Cash', note: 'Full payment' }).subscribe({
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

  openPayment(booking: Booking): void {
    this.paymentBooking = booking;
    this.paymentAmount = this.balance(booking) || 0;
    this.paymentMethod = 'Cash';
    this.paymentNote = '';
  }

  submitPayment(): void {
    if (!this.paymentBooking?._id || this.paymentAmount <= 0) return;
    this.actionLoadingId = this.paymentBooking._id;
    this.bookingService
      .addPayment(this.paymentBooking._id, {
        amount: this.paymentAmount,
        method: this.paymentMethod,
        note: this.paymentNote,
      })
      .subscribe({
        next: (res) => {
          this.replaceBooking(res.data);
          this.success = 'Payment recorded.';
          this.paymentBooking = null;
          this.actionLoadingId = '';
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to record payment';
          this.actionLoadingId = '';
        },
      });
  }

  openRoomChange(booking: Booking): void {
    this.roomChangeBooking = booking;
    this.newRoomId = '';
    this.bookingService.checkAvailability(booking.checkIn, booking.checkOut).subscribe({
      next: (res) => {
        this.rooms = res.data ?? [];
      },
      error: () => {
        this.bookingService.getRooms().subscribe({
          next: (r) => (this.rooms = r.data ?? []),
        });
      },
    });
  }

  submitRoomChange(): void {
    if (!this.roomChangeBooking?._id || !this.newRoomId) return;
    this.actionLoadingId = this.roomChangeBooking._id;
    this.bookingService.changeRoom(this.roomChangeBooking._id, this.newRoomId).subscribe({
      next: (res) => {
        this.replaceBooking(res.data);
        this.success = 'Room changed and total recalculated.';
        this.roomChangeBooking = null;
        this.actionLoadingId = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to change room';
        this.actionLoadingId = '';
      },
    });
  }

  openNotes(booking: Booking): void {
    this.notesBooking = booking;
    this.noteText = '';
  }

  submitNote(): void {
    if (!this.notesBooking?._id || !this.noteText.trim()) return;
    this.actionLoadingId = this.notesBooking._id;
    this.bookingService.addNote(this.notesBooking._id, this.noteText.trim()).subscribe({
      next: (res) => {
        this.replaceBooking(res.data);
        this.notesBooking = res.data;
        this.noteText = '';
        this.success = 'Note added.';
        this.actionLoadingId = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to add note';
        this.actionLoadingId = '';
      },
    });
  }

  onIdUpload(booking: Booking, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !booking._id) return;
    this.actionLoadingId = booking._id;
    this.bookingService.uploadIdDocument(booking._id, file).subscribe({
      next: (res) => {
        this.replaceBooking(res.data);
        this.success = 'ID document uploaded.';
        this.actionLoadingId = '';
        input.value = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Upload failed';
        this.actionLoadingId = '';
      },
    });
  }

  notify(booking: Booking, channel: 'email' | 'sms' = 'email'): void {
    if (!booking._id) return;
    this.actionLoadingId = booking._id;
    this.bookingService.notify(booking._id, channel).subscribe({
      next: (res) => {
        this.success = res.message;
        this.actionLoadingId = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Notify failed';
        this.actionLoadingId = '';
      },
    });
  }

  openFolio(booking: Booking): void {
    if (!booking._id) return;
    this.actionLoadingId = booking._id;
    this.bookingService.getFolio(booking._id).subscribe({
      next: (res) => {
        this.folio = res.data;
        this.showFolio = true;
        this.actionLoadingId = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load folio';
        this.actionLoadingId = '';
      },
    });
  }

  printFolio(): void {
    window.print();
  }

  processNoShows(): void {
    if (!confirm('Mark all overdue confirmed bookings as No-Show?')) return;
    this.bookingService.processNoShows().subscribe({
      next: (res) => {
        this.success = res.message;
        this.loadBookings();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to process no-shows';
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

  deleteBooking(booking: Booking): void {
    if (!booking._id || !this.canManageBookings) return;
    if (!confirm(`Delete booking for ${this.guestName(booking)} permanently?`)) return;
    this.actionLoadingId = booking._id;
    this.bookingService.deleteBooking(booking._id).subscribe({
      next: () => {
        this.bookings = this.bookings.filter((b) => b._id !== booking._id);
        this.applyFilters();
        this.success = 'Booking deleted.';
        this.actionLoadingId = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete booking';
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
