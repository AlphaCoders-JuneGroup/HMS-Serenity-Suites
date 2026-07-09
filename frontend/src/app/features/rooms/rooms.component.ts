import { Component, OnInit } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [JsonPipe],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss',
})
export class RoomsComponent implements OnInit {
  rooms: unknown[] = [];
  loading = true;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getRooms().subscribe({
      next: (res) => {
        this.rooms = res.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load rooms';
        this.loading = false;
      },
    });
  }
}
