import { Component, OnInit, OnDestroy } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  Booking,
  BookingGuest,
  BookingRoom,
  BookingService,
} from '../../core/services/booking.service';
import { AuthService } from '../../core/services/auth.service';
import {
  guestEmailValidator,
  guestNameValidator,
  sriLankanPhoneValidator,
} from '../../core/validators/guest-field.validators';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-check-in-desk',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './check-in-desk.component.html',
  styles: [`
    .leaving-today {
      background-color: #ffedd5;
      color: #c2410c;
      padding: 0.125rem 0.5rem;
      font-size: 0.65rem;
      font-weight: 600;
      border-radius: 9999px;
      border: 1px solid #fdba74;
      display: inline-block;
      vertical-align: middle;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  `]
})
export class CheckInDeskComponent implements OnInit, OnDestroy {
  arrivals: Booking[] = [];
  departures: Booking[] = [];
  inHouse: Booking[] = [];
  loading = true;
  error = '';
  success = '';
  actionId = '';
  showWalkIn = false;
  guests: BookingGuest[] = [];
  rooms: BookingRoom[] = [];
  walkInGuestId = '';
  walkInRoomId = '';
  walkInForm!: FormGroup;
  useNewGuest = false;
  
  private pollingSub?: Subscription;
  private updateSub?: Subscription;

  constructor(
    private bookingService: BookingService,
    private auth: AuthService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.walkInForm = this.fb.group({
      firstName: ['', [guestNameValidator()]],
      lastName: ['', [guestNameValidator()]],
      email: ['', [guestEmailValidator()]],
      phone: ['', [sriLankanPhoneValidator()]],
    });
  }

  get canManage(): boolean {
    return this.auth.hasRole('Admin', 'Receptionist');
  }

  ngOnInit(): void {
    this.loadDesk();
    this.bookingService.getGuests().subscribe({ next: (r) => (this.guests = r.data ?? []) });

    // Reactively refresh when a booking is modified anywhere in this browser window
    this.updateSub = this.bookingService.bookingUpdated$.subscribe(() => {
      this.loadDesk();
    });

    // Poll every 15 seconds to ensure multi-user/multi-tab synchronization
    this.pollingSub = timer(15000, 15000).subscribe(() => {
      this.loadDesk(false); // pass false to avoid showing the loading spinner overlay
    });
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
    this.updateSub?.unsubscribe();
  }

  loadDesk(showLoading = true): void {
    if (showLoading) this.loading = true;
    this.bookingService.getDeskToday().subscribe({
      next: (res) => {
        this.arrivals = res.data.arrivals ?? [];
        this.departures = res.data.departures ?? [];
        this.inHouse = res.data.inHouse ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load desk';
        this.loading = false;
      },
    });
  }

  guestName(b: Booking): string {
    if (!b.guest || typeof b.guest === 'string') return 'Guest';
    return `${b.guest.firstName} ${b.guest.lastName}`;
  }

  guestId(b: Booking): string | null {
    if (!b.guest) return null;
    return typeof b.guest === 'string' ? b.guest : b.guest._id || null;
  }

  roomLabel(b: Booking): string {
    if (!b.room || typeof b.room === 'string') return '—';
    return `Room ${b.room.roomNumber}`;
  }

  checkIn(b: Booking): void {
    if (!b._id || !this.canManage) return;
    this.actionId = b._id;
    this.bookingService.checkIn(b._id).subscribe({
      next: () => {
        this.success = 'Guest checked in.';
        this.actionId = '';
        this.loadDesk();
      },
      error: (err) => {
        this.error = err.error?.message || 'Check-in failed';
        this.actionId = '';
      },
    });
  }

  /** Returns the outstanding balance (>= 0) for a booking. */
  balance(b: Booking): number {
    return Math.max(0, (b.totalAmount || 0) - (b.amountPaid || 0));
  }

  checkOut(b: Booking): void {
    if (!b._id || !this.canManage) return;

    // If balance is not settled, redirect to Billing & Payments page
    if (this.balance(b) > 0) {
      this.error = 'Outstanding balance must be settled before check-out. Redirecting to Billing…';
      this.router.navigate(['/billing']);
      return;
    }

    this.actionId = b._id;
    this.bookingService.checkOut(b._id).subscribe({
      next: () => {
        this.success = 'Guest checked out successfully.';
        this.actionId = '';
        this.loadDesk();
      },
      error: (err) => {
        this.error = err.error?.message || 'Check-out failed';
        this.actionId = '';
      },
    });
  }

  openWalkIn(): void {
    this.showWalkIn = true;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    const checkIn = now.toISOString().slice(0, 19);
    const checkOut = `${tomorrow.toISOString().slice(0, 10)}T12:00:00`;
    this.bookingService.checkAvailability(checkIn, checkOut).subscribe({
      next: (res) => (this.rooms = res.data ?? []),
    });
  }

  submitWalkIn(): void {
    if (!this.canManage || !this.walkInRoomId) {
      this.error = 'Select a room for walk-in.';
      return;
    }
    const payload: any = { room: this.walkInRoomId };
    if (this.useNewGuest) {
      if (this.walkInForm.invalid) {
        this.walkInForm.markAllAsTouched();
        this.error = 'Fix guest details.';
        return;
      }
      payload.guestDetails = this.walkInForm.value;
    } else {
      if (!this.walkInGuestId) {
        this.error = 'Select or register a guest.';
        return;
      }
      payload.guest = this.walkInGuestId;
    }

    this.bookingService.walkIn(payload).subscribe({
      next: () => {
        this.success = 'Walk-in checked in.';
        this.showWalkIn = false;
        this.loadDesk();
      },
      error: (err) => {
        this.error = err.error?.message || 'Walk-in failed';
      },
    });
  }

  isLeavingToday(checkOutDate: string | Date): boolean {
    if (!checkOutDate) return false;
    const checkout = new Date(checkOutDate);
    const today = new Date();
    return (
      checkout.getDate() === today.getDate() &&
      checkout.getMonth() === today.getMonth() &&
      checkout.getFullYear() === today.getFullYear()
    );
  }
}
