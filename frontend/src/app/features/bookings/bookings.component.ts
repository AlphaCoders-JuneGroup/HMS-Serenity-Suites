import { Component, OnInit } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.scss',
})
export class BookingsComponent implements OnInit {
  bookings: unknown[] = [];
  loading = true;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getBookings().subscribe({
      next: (res) => {
        this.bookings = res.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load bookings';
        this.loading = false;
      },
    });
  }
}
