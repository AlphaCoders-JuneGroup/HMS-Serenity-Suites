import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Booking,
  BookingGuest,
  BookingRoom,
  BookingService,
} from '../../../core/services/booking.service';

@Component({
  selector: 'app-booking-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './booking-form.component.html',
})
export class BookingFormComponent implements OnInit {
  form!: FormGroup;
  guestForm!: FormGroup;
  isEditMode = false;
  bookingId: string | null = null;
  loading = false;
  loadingData = true;
  checkingAvailability = false;
  showGuestForm = false;
  error = '';
  success = '';

  guests: BookingGuest[] = [];
  availableRooms: BookingRoom[] = [];
  selectedRoom: BookingRoom | null = null;
  nights = 0;
  estimatedTotal = 0;
  guestHistory: Booking[] = [];
  historyGuestName = '';

  readonly idTypes = ['Passport', 'National ID', 'Driving License'];

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.bookingId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.bookingId;
    this.buildForms();
    this.loadGuests();

    if (this.isEditMode) {
      this.loadBooking();
    } else {
      this.loadingData = false;
    }
  }

  buildForms(): void {
    const tomorrow = this.toDateInput(this.addDays(new Date(), 1));
    const dayAfter = this.toDateInput(this.addDays(new Date(), 2));

    this.form = this.fb.group({
      guest: ['', Validators.required],
      room: ['', Validators.required],
      checkIn: [tomorrow, Validators.required],
      checkOut: [dayAfter, Validators.required],
      numberOfGuests: [1, [Validators.required, Validators.min(1)]],
      specialRequests: [''],
      paymentStatus: ['Pending'],
      status: ['Pending'],
    });

    this.guestForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      nationality: [''],
      idType: [''],
      idNumber: [''],
      city: [''],
      country: [''],
    });
  }

  loadGuests(): void {
    this.bookingService.getGuests().subscribe({
      next: (res) => (this.guests = res.data ?? []),
      error: (err) => (this.error = err.error?.message || 'Failed to load guests'),
    });
  }

  loadBooking(): void {
    this.loadingData = true;
    this.bookingService.getBookingById(this.bookingId!).subscribe({
      next: (res) => {
        const b = res.data;
        const guestId = typeof b.guest === 'string' ? b.guest : b.guest?._id;
        const roomId = typeof b.room === 'string' ? b.room : b.room?._id;

        this.form.patchValue({
          guest: guestId,
          room: roomId,
          checkIn: this.toDateInput(new Date(b.checkIn)),
          checkOut: this.toDateInput(new Date(b.checkOut)),
          numberOfGuests: b.numberOfGuests || 1,
          specialRequests: b.specialRequests || '',
          paymentStatus: b.paymentStatus,
          status: b.status,
        });

        if (typeof b.room !== 'string' && b.room) {
          this.availableRooms = [b.room];
          this.selectedRoom = b.room;
        }

        this.updateEstimate();
        if (guestId) this.loadGuestHistory(guestId);
        this.loadingData = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load booking';
        this.loadingData = false;
      },
    });
  }

  onGuestChange(): void {
    const guestId = this.form.value.guest;
    if (guestId) this.loadGuestHistory(guestId);
    else {
      this.guestHistory = [];
      this.historyGuestName = '';
    }
  }

  loadGuestHistory(guestId: string): void {
    this.bookingService.getGuestHistory(guestId).subscribe({
      next: (res) => {
        this.guestHistory = res.data ?? [];
        this.historyGuestName = `${res.guest.firstName} ${res.guest.lastName}`;
      },
      error: () => {
        this.guestHistory = [];
      },
    });
  }

  checkAvailability(): void {
    this.error = '';
    this.success = '';
    const { checkIn, checkOut } = this.form.value;

    if (!checkIn || !checkOut) {
      this.error = 'Select check-in and check-out dates first.';
      return;
    }
    if (new Date(checkOut) <= new Date(checkIn)) {
      this.error = 'Check-out must be after check-in.';
      return;
    }

    this.checkingAvailability = true;
    this.bookingService.checkAvailability(checkIn, checkOut).subscribe({
      next: (res) => {
        this.availableRooms = res.data ?? [];
        this.nights = res.nights;
        this.checkingAvailability = false;

        const currentRoom = this.form.value.room;
        if (currentRoom && !this.availableRooms.some((r) => r._id === currentRoom)) {
          this.form.patchValue({ room: '' });
          this.selectedRoom = null;
        }

        this.success =
          this.availableRooms.length > 0
            ? `${this.availableRooms.length} room(s) available for ${this.nights} night(s).`
            : 'No rooms available for the selected dates.';
        this.updateEstimate();
      },
      error: (err) => {
        this.checkingAvailability = false;
        this.error = err.error?.message || 'Availability check failed';
      },
    });
  }

  onRoomChange(): void {
    const roomId = this.form.value.room;
    this.selectedRoom = this.availableRooms.find((r) => r._id === roomId) || null;
    this.updateEstimate();
  }

  updateEstimate(): void {
    const { checkIn, checkOut } = this.form.value;
    if (checkIn && checkOut) {
      const ms =
        new Date(checkOut).setHours(0, 0, 0, 0) - new Date(checkIn).setHours(0, 0, 0, 0);
      this.nights = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
    }
    this.estimatedTotal = this.selectedRoom ? this.nights * (this.selectedRoom.price || 0) : 0;
  }

  registerGuest(): void {
    if (this.guestForm.invalid) {
      this.guestForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const v = this.guestForm.value;

    this.bookingService
      .createGuest({
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        phone: v.phone,
        nationality: v.nationality || undefined,
        idType: v.idType || undefined,
        idNumber: v.idNumber || undefined,
        address: {
          city: v.city || undefined,
          country: v.country || undefined,
        },
      })
      .subscribe({
        next: (res) => {
          const guest = res.data;
          this.guests = [guest, ...this.guests];
          this.form.patchValue({ guest: guest._id });
          this.showGuestForm = false;
          this.guestForm.reset();
          this.success = `Guest ${guest.firstName} ${guest.lastName} registered.`;
          this.loadGuestHistory(guest._id!);
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to register guest';
          this.loading = false;
        },
      });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.availableRooms.length && !this.isEditMode) {
      this.error = 'Please check room availability before creating a booking.';
      return;
    }

    this.loading = true;
    this.error = '';
    const payload = {
      ...this.form.value,
      totalAmount: this.estimatedTotal || undefined,
    };

    const request$ = this.isEditMode
      ? this.bookingService.updateBooking(this.bookingId!, payload)
      : this.bookingService.createBooking(payload);

    request$.subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/bookings']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to save booking';
        this.loading = false;
      },
    });
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

  private toDateInput(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
}
