import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  apiStatus = 'Checking...';
  roomCount = 0;
  guestCount = 0;
  bookingCount = 0;
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getHealth().subscribe({
      next: (res) => (this.apiStatus = res.status),
      error: () => (this.apiStatus = 'Offline'),
    });

    this.api.getRooms().subscribe({
      next: (res) => (this.roomCount = res.count ?? 0),
      error: () => (this.roomCount = 0),
    });

    this.api.getGuests().subscribe({
      next: (res) => (this.guestCount = res.count ?? 0),
      error: () => (this.guestCount = 0),
    });

    this.api.getBookings().subscribe({
      next: (res) => {
        this.bookingCount = res.count ?? 0;
        this.loading = false;
      },
      error: () => {
        this.bookingCount = 0;
        this.loading = false;
      },
    });
  }
}
