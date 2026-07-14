import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Booking, BookingRoom, BookingService } from '../../../core/services/booking.service';

@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './booking-calendar.component.html',
})
export class BookingCalendarComponent implements OnInit {
  rooms: BookingRoom[] = [];
  bookings: Booking[] = [];
  days: Date[] = [];
  from = '';
  to = '';
  loading = true;
  error = '';

  ngOnInit(): void {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    this.from = this.toInput(start);
    this.to = this.toInput(end);
    this.load();
  }

  constructor(private bookingService: BookingService) {}

  load(): void {
    this.loading = true;
    const fromDate = new Date(this.from);
    const toDate = new Date(this.to);
    toDate.setHours(23, 59, 59, 999);
    this.buildDays(fromDate, toDate);

    this.bookingService.getCalendar(fromDate.toISOString(), toDate.toISOString()).subscribe({
      next: (res) => {
        this.rooms = res.rooms ?? [];
        this.bookings = res.bookings ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load calendar';
        this.loading = false;
      },
    });
  }

  buildDays(from: Date, to: Date): void {
    const days: Date[] = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    this.days = days;
  }

  isOccupied(roomId: string | undefined, day: Date): Booking | null {
    if (!roomId) return null;
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return (
      this.bookings.find((b) => {
        const rid = typeof b.room === 'string' ? b.room : b.room?._id;
        if (rid !== roomId) return false;
        const cin = new Date(b.checkIn);
        const cout = new Date(b.checkOut);
        return cin < dayEnd && cout > dayStart;
      }) || null
    );
  }

  guestLabel(b: Booking): string {
    if (!b.guest || typeof b.guest === 'string') return 'Booked';
    return `${b.guest.firstName} ${b.guest.lastName}`.trim();
  }

  guestId(b: Booking): string | null {
    if (!b.guest) return null;
    return typeof b.guest === 'string' ? b.guest : b.guest._id || null;
  }

  private toInput(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
