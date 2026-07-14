import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

export interface HousekeepingRoom {
  _id?: string;
  roomNumber: string;
  type: string;
  price: number;
  capacity: number;
  status: 'Available' | 'Booked' | 'Occupied' | 'Cleaning' | 'Maintenance' | 'Reserved';
  floor: number;
  description?: string;
  amenities?: string[];
}

@Component({
  selector: 'app-housekeeping',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './housekeeping.component.html',
  styleUrl: './housekeeping.component.scss',
})
export class HousekeepingComponent implements OnInit {
  rooms: HousekeepingRoom[] = [];
  loading = true;
  error = '';
  success = '';
  
  // Filtering & Search
  searchTerm = '';
  filterStatus = 'Cleaning'; // Default to Cleaning/Dirty rooms queue

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadRooms();
  }

  loadRooms(): void {
    this.loading = true;
    this.error = '';
    this.api.getRooms().subscribe({
      next: (res) => {
        this.rooms = (res.data ?? []) as HousekeepingRoom[];
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to load rooms';
        this.loading = false;
      },
    });
  }

  // --- Filtering & Searching ---
  get filteredRooms(): HousekeepingRoom[] {
    let result = this.rooms;

    if (this.filterStatus) {
      result = result.filter((r) => r.status === this.filterStatus);
    }

    if (this.searchTerm) {
      const q = this.searchTerm.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.roomNumber.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          `floor ${r.floor}`.includes(q)
      );
    }

    return result;
  }

  // --- Metrics ---
  get dirtyCount(): number {
    return this.rooms.filter((r) => r.status === 'Cleaning').length;
  }

  get cleanCount(): number {
    return this.rooms.filter((r) => r.status === 'Available').length;
  }

  get occupiedCount(): number {
    return this.rooms.filter((r) => r.status === 'Occupied').length;
  }

  get maintenanceCount(): number {
    return this.rooms.filter((r) => r.status === 'Maintenance').length;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Available':
        return 'badge-success';
      case 'Occupied':
        return 'badge-info';
      case 'Reserved':
      case 'Booked':
        return 'badge-warning';
      case 'Maintenance':
        return 'badge-danger';
      case 'Cleaning':
        return 'bg-purple-100 text-purple-700 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold';
      default:
        return 'badge-neutral';
    }
  }

  // --- Actions ---
  updateRoomStatus(room: HousekeepingRoom, status: 'Available' | 'Cleaning' | 'Maintenance'): void {
    this.loading = true;
    this.error = '';
    this.success = '';
    this.api.updateRoom(room._id!, { status }).subscribe({
      next: () => {
        this.success = `Room ${room.roomNumber} successfully updated to status '${status}'.`;
        this.loadRooms();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to update room housekeeping status';
        this.loading = false;
      },
    });
  }

  clearAlerts(): void {
    this.error = '';
    this.success = '';
  }
}
