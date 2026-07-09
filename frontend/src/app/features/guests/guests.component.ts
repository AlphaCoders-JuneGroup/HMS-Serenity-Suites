import { Component, OnInit } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-guests',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './guests.component.html',
  styleUrl: './guests.component.scss',
})
export class GuestsComponent implements OnInit {
  guests: unknown[] = [];
  loading = true;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getGuests().subscribe({
      next: (res) => {
        this.guests = res.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load guests';
        this.loading = false;
      },
    });
  }
}
