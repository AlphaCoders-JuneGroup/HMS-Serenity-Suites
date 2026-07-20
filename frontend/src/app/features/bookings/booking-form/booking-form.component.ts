import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
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
import {
  guestEmailValidator,
  guestNameValidator,
  sriLankanPhoneValidator,
} from '../../../core/validators/guest-field.validators';

@Component({
  selector: 'app-booking-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink, CurrencyPipe, DatePipe],
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
  stayHours = 0;
  estimatedTotal = 0;
  earlyCheckInFee = 0;
  lateCheckOutFee = 0;
  baseAmount = 0;
  discountAmount = 0;
  guestHistory: Booking[] = [];
  historyGuestName = '';
  groupMode = false;
  selectedRoomIds: string[] = [];

  readonly idTypes = ['Passport', 'National ID', 'Driving License'];
  /** Default hotel check-in / check-out times */
  readonly defaultCheckInTime = '14:00';
  readonly defaultCheckOutTime = '12:00';
  readonly FEE_RATE = 0.25;
  readonly STANDARD_CHECK_IN_HOUR = 14;
  readonly STANDARD_CHECK_OUT_HOUR = 12;

  constructor(
    private fb: FormBuilder,
    private bookingService: BookingService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.bookingId = params.get('id');
      this.isEditMode = !!this.bookingId;
      
      this.buildForms();
      this.loadGuests();

      const preselectGuest = this.route.snapshot.queryParamMap.get('guest');
      if (preselectGuest && !this.isEditMode) {
        this.form.patchValue({ guest: preselectGuest });
        this.loadGuestHistory(preselectGuest);
      }

      if (this.isEditMode) {
        this.loadBooking();
      } else {
        this.loadingData = false;
      }
    });
  }

  buildForms(): void {
    const tomorrow = this.toDateInput(this.addDays(new Date(), 1));
    const dayAfter = this.toDateInput(this.addDays(new Date(), 2));

    this.form = this.fb.group({
      guest: ['', Validators.required],
      room: [''],
      checkIn: [tomorrow, Validators.required],
      checkInTime: [this.defaultCheckInTime, Validators.required],
      checkOut: [dayAfter, Validators.required],
      checkOutTime: [this.defaultCheckOutTime, Validators.required],
      numberOfGuests: [1, [Validators.required, Validators.min(1)]],
      specialRequests: [''],
      discountPercent: [0, [Validators.min(0), Validators.max(100)]],
      promoCode: [''],
    });

    this.guestForm = this.fb.group({
      firstName: ['', [guestNameValidator()]],
      lastName: ['', [guestNameValidator()]],
      email: ['', [guestEmailValidator()]],
      phone: ['', [sriLankanPhoneValidator()]],
      nationality: [''],
      idType: [''],
      idNumber: [''],
      city: [''],
      country: [''],
    });
  }

  onGuestPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    if (input.value !== digits) {
      this.guestForm.get('phone')?.setValue(digits, { emitEvent: true });
      input.value = digits;
    }
  }

  guestFieldError(controlName: string): boolean {
    const ctrl = this.guestForm.get(controlName);
    return !!ctrl && ctrl.invalid && ctrl.touched;
  }

  guestPhoneError(): string {
    const errors = this.guestForm.get('phone')?.errors;
    if (!errors) return '';
    if (errors['required']) return 'Phone number is required.';
    if (errors['empty']) return 'Please enter a phone number.';
    if (errors['digitsOnly']) return 'Phone number must contain only numbers.';
    if (errors['length']) return 'Phone number must be exactly 10 digits.';
    if (errors['startsWithZero']) return 'Phone number must start with 0.';
    if (errors['invalidFormat']) return 'Please enter a valid phone number.';
    if (errors['duplicate']) return 'This phone number is already registered.';
    return 'Please enter a valid phone number.';
  }

  guestEmailError(): string {
    const errors = this.guestForm.get('email')?.errors;
    if (!errors) return '';
    if (errors['required']) return 'Email is required.';
    if (errors['empty']) return 'Please enter an email address.';
    if (errors['invalidFormat'] || errors['email']) return 'Please enter a valid email address.';
    if (errors['duplicate']) return 'This email is already registered.';
    return 'Please enter a valid email address.';
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
          checkInTime: this.toTimeInput(new Date(b.checkIn)),
          checkOut: this.toDateInput(new Date(b.checkOut)),
          checkOutTime: this.toTimeInput(new Date(b.checkOut)),
          numberOfGuests: b.numberOfGuests || 1,
          specialRequests: b.specialRequests || '',
          discountPercent: b.discountPercent || 0,
          promoCode: b.promoCode || '',
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
    const checkInAt = this.getCheckInDateTime();
    const checkOutAt = this.getCheckOutDateTime();

    if (!checkInAt || !checkOutAt) {
      this.error = 'Select check-in and check-out date and time first.';
      return;
    }
    if (new Date(checkOutAt) <= new Date(checkInAt)) {
      this.error = 'Check-out must be after check-in (date and time).';
      return;
    }

    this.checkingAvailability = true;
    this.bookingService.checkAvailability(checkInAt, checkOutAt).subscribe({
      next: (res) => {
        this.availableRooms = res.data ?? [];
        this.nights = res.nights;
        this.stayHours = res.hours ?? this.stayHours;
        this.checkingAvailability = false;

        const currentRoom = this.form.value.room;
        if (currentRoom && !this.availableRooms.some((r) => r._id === currentRoom)) {
          this.form.patchValue({ room: '' });
          this.selectedRoom = null;
        }

        this.success =
          this.availableRooms.length > 0
            ? `${this.availableRooms.length} room(s) available for ${this.stayHours}h (${this.nights} night(s)).`
            : 'No rooms available for the selected dates/times.';
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

  toggleGroupRoom(roomId: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedRoomIds.includes(roomId)) this.selectedRoomIds = [...this.selectedRoomIds, roomId];
    } else {
      this.selectedRoomIds = this.selectedRoomIds.filter((id) => id !== roomId);
    }
    this.updateEstimate();
  }

  isGroupRoomSelected(roomId: string): boolean {
    return this.selectedRoomIds.includes(roomId);
  }

  updateEstimate(): void {
    const checkInAt = this.getCheckInDateTime();
    const checkOutAt = this.getCheckOutDateTime();
    const discount = Number(this.form.value.discountPercent) || 0;

    if (checkInAt && checkOutAt) {
      const start = new Date(checkInAt);
      const end = new Date(checkOutAt);
      const ms = end.getTime() - start.getTime();
      if (ms > 0) {
        this.stayHours = Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
        this.nights = Math.max(1, Math.ceil(this.stayHours / 24));
      } else {
        this.stayHours = 0;
        this.nights = 0;
      }

      const inMin = start.getHours() * 60 + start.getMinutes();
      const outMin = end.getHours() * 60 + end.getMinutes();

      const roomsForEstimate = this.groupMode
        ? this.availableRooms.filter((r) => r._id && this.selectedRoomIds.includes(r._id))
        : this.selectedRoom
          ? [this.selectedRoom]
          : [];

      let base = 0;
      let early = 0;
      let late = 0;
      for (const room of roomsForEstimate) {
        const price = room.price || 0;
        base += this.nights * price;
        if (inMin < this.STANDARD_CHECK_IN_HOUR * 60) early += Math.round(price * this.FEE_RATE);
        if (outMin > this.STANDARD_CHECK_OUT_HOUR * 60) late += Math.round(price * this.FEE_RATE);
      }
      this.baseAmount = base;
      this.earlyCheckInFee = early;
      this.lateCheckOutFee = late;
      const subtotal = base + early + late;
      this.discountAmount = Math.round((subtotal * discount) / 100);
      this.estimatedTotal = Math.max(0, subtotal - this.discountAmount);
    } else {
      this.estimatedTotal = 0;
    }
  }

  getCheckInDateTime(): string | null {
    const { checkIn, checkInTime } = this.form.value;
    if (!checkIn || !checkInTime) return null;
    return this.combineDateAndTime(checkIn, checkInTime);
  }

  getCheckOutDateTime(): string | null {
    const { checkOut, checkOutTime } = this.form.value;
    if (!checkOut || !checkOutTime) return null;
    return this.combineDateAndTime(checkOut, checkOutTime);
  }

  registerGuest(): void {
    this.guestForm.markAllAsTouched();
    if (this.guestForm.invalid) {
      this.error = 'Please fix guest form validation errors.';
      return;
    }

    this.loading = true;
    this.error = '';
    const v = this.guestForm.value;

    this.bookingService
      .createGuest({
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        email: v.email.trim().toLowerCase(),
        phone: String(v.phone).trim(),
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
          const msg = err.error?.message || 'Failed to register guest';
          this.error = msg;
          this.loading = false;
          if (/phone number is already registered/i.test(msg)) {
            this.guestForm.get('phone')?.setErrors({
              ...(this.guestForm.get('phone')?.errors || {}),
              duplicate: true,
            });
          }
          if (/email is already registered|email already exists/i.test(msg)) {
            this.guestForm.get('email')?.setErrors({
              ...(this.guestForm.get('email')?.errors || {}),
              duplicate: true,
            });
          }
        },
      });
  }

  onSubmit(): void {
    if (this.form.get('guest')?.invalid || this.form.get('checkIn')?.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const checkInAt = this.getCheckInDateTime();
    const checkOutAt = this.getCheckOutDateTime();
    if (!checkInAt || !checkOutAt) {
      this.error = 'Check-in and check-out date/time are required.';
      return;
    }
    if (new Date(checkOutAt) <= new Date(checkInAt)) {
      this.error = 'Check-out must be after check-in (date and time).';
      return;
    }

    if (!this.availableRooms.length && !this.isEditMode) {
      this.error = 'Please check room availability before creating a booking.';
      return;
    }

    this.updateEstimate();
    this.loading = true;
    this.error = '';

    const v = this.form.value;

    if (!this.isEditMode && this.groupMode) {
      if (this.selectedRoomIds.length < 2) {
        this.error = 'Select at least 2 rooms for a group booking.';
        this.loading = false;
        return;
      }
      this.bookingService
        .createGroupBooking({
          guest: v.guest,
          rooms: this.selectedRoomIds,
          checkIn: checkInAt,
          checkOut: checkOutAt,
          numberOfGuests: v.numberOfGuests,
          specialRequests: v.specialRequests,
          discountPercent: v.discountPercent || 0,
          promoCode: v.promoCode || '',
        })
        .subscribe({
          next: (res) => {
            this.loading = false;
            this.success = `Group ${res.groupId} created (${res.count} rooms).`;
            this.router.navigate(['/bookings']);
          },
          error: (err) => {
            this.error = err.error?.message || 'Failed to create group booking';
            this.loading = false;
          },
        });
      return;
    }

    if (!v.room) {
      this.error = 'Please select a room.';
      this.loading = false;
      return;
    }

    const payload = {
      guest: v.guest,
      room: v.room,
      checkIn: checkInAt,
      checkOut: checkOutAt,
      numberOfGuests: v.numberOfGuests,
      specialRequests: v.specialRequests,
      discountPercent: v.discountPercent || 0,
      promoCode: v.promoCode || '',
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

  private combineDateAndTime(dateStr: string, timeStr: string): string {
    const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
    return `${dateStr}T${time}`;
  }

  private toDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toTimeInput(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
}
