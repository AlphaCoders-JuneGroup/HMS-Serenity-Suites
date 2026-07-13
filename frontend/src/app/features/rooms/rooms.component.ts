import { Component, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

export interface Room {
  _id?: string;
  roomNumber: string;
  type: string;
  price: number;
  capacity: number;
  amenities?: string[];
  status: 'Available' | 'Occupied' | 'Maintenance' | 'Reserved';
  floor: number;
  description?: string;
}

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss',
})
export class RoomsComponent implements OnInit {
  rooms: Room[] = [];
  loading = true;
  error = '';
  filterStatus = '';

  constructor(private api: ApiService) {}

  get filteredRooms(): Room[] {
    if (!this.filterStatus) return this.rooms;
    return this.rooms.filter((r) => r.status === this.filterStatus);
  }

  get availableCount(): number {
    return this.rooms.filter((r) => r.status === 'Available').length;
  }

  get occupiedCount(): number {
    return this.rooms.filter((r) => r.status === 'Occupied').length;
  }

  get maintenanceCount(): number {
    return this.rooms.filter((r) => r.status === 'Maintenance').length;
  }

  get reservedCount(): number {
    return this.rooms.filter((r) => r.status === 'Reserved').length;
  }

  get occupancyRate(): number {
    if (!this.rooms.length) return 0;
    return Math.round((this.occupiedCount / this.rooms.length) * 100);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Available':
        return 'badge-success';
      case 'Occupied':
        return 'badge-info';
      case 'Reserved':
        return 'badge-warning';
      case 'Maintenance':
        return 'badge-danger';
      default:
        return 'badge-neutral';
    }
  }

  ngOnInit(): void {
    this.api.getRooms().subscribe({
      next: (res) => {
        this.rooms = (res.data ?? []) as Room[];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message || 'Failed to load rooms';
        this.loading = false;
      },
    });
  }
}
