import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

export interface Room {
  _id?: string;
  roomNumber: string;
  type: string;
  price: number;
  capacity: number;
  amenities?: string[];
  status: 'Available' | 'Booked' | 'Occupied' | 'Cleaning' | 'Maintenance' | 'Reserved';
  floor: number;
  description?: string;
}

export interface RoomType {
  _id?: string;
  name: string;
  description?: string;
  basePrice: number;
  capacity: number;
  amenities?: string[];
}

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, CurrencyPipe],
  templateUrl: './rooms.component.html',
  styleUrl: './rooms.component.scss',
})
export class RoomsComponent implements OnInit {
  rooms: Room[] = [];
  roomTypes: RoomType[] = [];
  activeTab: 'rooms' | 'types' = 'rooms';
  loading = true;
  error = '';
  success = '';

  // Filters state
  searchTerm = '';
  filterType = '';
  filterStatus = '';
  filterCheckIn = '';
  filterCheckOut = '';
  availableRoomIdsForDates: Set<string> | null = null;
  loadingAvailability = false;
  overlappingBookingsMap = new Map<string, string>();

  // Modals state
  showRoomModal = false;
  showTypeModal = false;
  showDeleteRoomModal = false;
  showDeleteTypeModal = false;

  // Selected items
  editingRoom: Room | null = null;
  editingType: RoomType | null = null;
  deletingRoom: Room | null = null;
  deletingType: RoomType | null = null;

  // Forms
  roomForm!: FormGroup;
  typeForm!: FormGroup;

  // Active status lists for dropdown filter
  readonly statusOptions = ['Available', 'Booked', 'Occupied', 'Cleaning', 'Maintenance', 'Reserved'];

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.buildForms();
    this.loadData();
  }

  buildForms(): void {
    this.roomForm = this.fb.group({
      roomNumber: ['', [Validators.required, Validators.pattern(/^[0-9a-zA-Z-]+$/)]],
      type: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0)]],
      capacity: [1, [Validators.required, Validators.min(1)]],
      floor: [1, [Validators.required, Validators.min(0)]],
      status: ['Available', [Validators.required]],
      amenities: [''],
      description: [''],
    });

    this.typeForm = this.fb.group({
      name: ['', [Validators.required]],
      description: [''],
      basePrice: [0, [Validators.required, Validators.min(0)]],
      capacity: [1, [Validators.required, Validators.min(1)]],
      amenities: [''],
    });
  }

  loadData(): void {
    this.loading = true;
    this.error = '';
    this.api.getRooms().subscribe({
      next: (roomsRes) => {
        this.rooms = (roomsRes.data ?? []) as Room[];
        this.api.getRoomTypes().subscribe({
          next: (typesRes) => {
            this.roomTypes = (typesRes.data ?? []) as RoomType[];
            this.loading = false;
          },
          error: (err) => {
            this.error = err.error?.message || err.message || 'Failed to load room types';
            this.loading = false;
          }
        });
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to load rooms';
        this.loading = false;
      }
    });
  }

  // --- Permissions Checkers ---
  get canManageRooms(): boolean {
    return this.auth.hasRole('Admin', 'Manager');
  }

  get canUpdateStatus(): boolean {
    return this.auth.hasRole('Admin', 'Manager', 'Receptionist', 'Housekeeping Manager');
  }

  // --- Date filtering logic ---
  onDateFilterChange(): void {
    if (!this.filterCheckIn || !this.filterCheckOut) {
      this.availableRoomIdsForDates = null;
      this.overlappingBookingsMap.clear();
      return;
    }

    const start = new Date(this.filterCheckIn);
    const end = new Date(this.filterCheckOut);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      this.availableRoomIdsForDates = null;
      this.overlappingBookingsMap.clear();
      return;
    }

    this.loadingAvailability = true;
    this.error = '';
    this.api.checkRoomAvailability(this.filterCheckIn, this.filterCheckOut).subscribe({
      next: (res: any) => {
        const roomsList = res.data ?? [];
        this.availableRoomIdsForDates = new Set(roomsList.map((r: any) => r._id));

        // Populate overlappingBookingsMap
        this.overlappingBookingsMap.clear();
        const conflicting = res.conflictingBookings || [];
        conflicting.forEach((b: any) => {
          const roomId = typeof b.room === 'string' ? b.room : b.room?._id || b.room;
          if (roomId) {
            const existingStatus = this.overlappingBookingsMap.get(roomId);
            if (b.status === 'Checked-In') {
              this.overlappingBookingsMap.set(roomId, 'Occupied');
            } else if (b.status === 'Confirmed' || b.status === 'Pending') {
              if (existingStatus !== 'Occupied') {
                this.overlappingBookingsMap.set(roomId, 'Booked');
              }
            }
          }
        });

        this.loadingAvailability = false;
      },
      error: (err) => {
        this.error = err.error?.message || err.message || 'Failed to check date availability';
        this.loadingAvailability = false;
        this.availableRoomIdsForDates = null;
        this.overlappingBookingsMap.clear();
      }
    });
  }

  clearDateFilter(): void {
    this.filterCheckIn = '';
    this.filterCheckOut = '';
    this.availableRoomIdsForDates = null;
    this.overlappingBookingsMap.clear();
  }

  clearAllFilters(): void {
    this.searchTerm = '';
    this.filterType = '';
    this.filterStatus = '';
    this.clearDateFilter();
  }

  getDisplayStatus(room: Room): string {
    if (this.filterCheckIn && this.filterCheckOut) {
      if (room.status === 'Maintenance') {
        return 'Maintenance';
      }
      if (room.status === 'Cleaning') {
        return 'Cleaning';
      }
      const override = this.overlappingBookingsMap.get(room._id!);
      if (override) {
        return override;
      }
      return 'Available';
    }
    return room.status;
  }

  // --- Filtering & Metrics ---
  get filteredRooms(): Room[] {
    let result = this.rooms;

    // 1. Text Search Filter (number, floor, amenities, description)
    if (this.searchTerm) {
      const q = this.searchTerm.trim().toLowerCase();
      result = result.filter((r) => {
        const roomNum = (r.roomNumber || '').toLowerCase();
        const floorStr = `floor ${r.floor}`;
        const descStr = (r.description || '').toLowerCase();
        const amenitiesStr = (r.amenities || []).join(' ').toLowerCase();
        const typeStr = (r.type || '').toLowerCase();
        return (
          roomNum.includes(q) ||
          floorStr.includes(q) ||
          descStr.includes(q) ||
          amenitiesStr.includes(q) ||
          typeStr.includes(q)
        );
      });
    }

    // 2. Room Type Filter
    if (this.filterType) {
      result = result.filter((r) => r.type === this.filterType);
    }

    // 3. Status Filter (using display status!)
    if (this.filterStatus) {
      if (this.filterStatus === 'Booked') {
        result = result.filter((r) => {
          const status = this.getDisplayStatus(r);
          return status === 'Booked' || status === 'Reserved';
        });
      } else {
        result = result.filter((r) => this.getDisplayStatus(r) === this.filterStatus);
      }
    }

    return result;
  }

  get availableCount(): number {
    return this.rooms.filter((r) => this.getDisplayStatus(r) === 'Available').length;
  }

  get occupiedCount(): number {
    return this.rooms.filter((r) => this.getDisplayStatus(r) === 'Occupied').length;
  }

  get bookedCount(): number {
    return this.rooms.filter((r) => {
      const status = this.getDisplayStatus(r);
      return status === 'Booked' || status === 'Reserved';
    }).length;
  }

  get cleaningCount(): number {
    return this.rooms.filter((r) => this.getDisplayStatus(r) === 'Cleaning').length;
  }

  get maintenanceCount(): number {
    return this.rooms.filter((r) => this.getDisplayStatus(r) === 'Maintenance').length;
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

  // --- Room Actions ---
  openAddRoomModal(): void {
    this.editingRoom = null;
    this.roomForm.reset({
      roomNumber: '',
      type: '',
      price: 0,
      capacity: 1,
      floor: 1,
      status: 'Available',
      amenities: '',
      description: '',
    });
    this.showRoomModal = true;
    this.error = '';
    this.success = '';
  }

  openEditRoomModal(room: Room): void {
    this.editingRoom = room;
    this.roomForm.patchValue({
      roomNumber: room.roomNumber,
      type: room.type,
      price: room.price,
      capacity: room.capacity,
      floor: room.floor,
      status: room.status,
      amenities: room.amenities ? room.amenities.join(', ') : '',
      description: room.description || '',
    });
    this.showRoomModal = true;
    this.error = '';
    this.success = '';
  }

  onRoomTypeChange(event: Event): void {
    const selectedTypeName = (event.target as HTMLSelectElement).value;
    const roomType = this.roomTypes.find((t) => t.name === selectedTypeName);
    if (roomType) {
      this.roomForm.patchValue({
        price: roomType.basePrice,
        capacity: roomType.capacity,
        amenities: roomType.amenities ? roomType.amenities.join(', ') : '',
      });
    }
  }

  saveRoom(): void {
    if (this.roomForm.invalid) {
      this.roomForm.markAllAsTouched();
      return;
    }

    const formVal = this.roomForm.value;
    const payload = {
      ...formVal,
      price: Number(formVal.price),
      capacity: Number(formVal.capacity),
      floor: Number(formVal.floor),
      amenities: formVal.amenities
        ? formVal.amenities.split(',').map((a: string) => a.trim()).filter(Boolean)
        : [],
    };

    this.loading = true;
    this.error = '';
    this.success = '';

    if (this.editingRoom) {
      this.api.updateRoom(this.editingRoom._id!, payload).subscribe({
        next: () => {
          this.success = `Room ${payload.roomNumber} updated successfully!`;
          this.showRoomModal = false;
          this.loadData();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to update room';
          this.loading = false;
        }
      });
    } else {
      this.api.createRoom(payload).subscribe({
        next: () => {
          this.success = `Room ${payload.roomNumber} created successfully!`;
          this.showRoomModal = false;
          this.loadData();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to create room';
          this.loading = false;
        }
      });
    }
  }

  confirmDeleteRoom(room: Room): void {
    this.deletingRoom = room;
    this.showDeleteRoomModal = true;
    this.error = '';
    this.success = '';
  }

  deleteRoom(): void {
    if (!this.deletingRoom) return;
    this.loading = true;
    this.api.deleteRoom(this.deletingRoom._id!).subscribe({
      next: () => {
        this.success = `Room ${this.deletingRoom?.roomNumber} deleted successfully!`;
        this.showDeleteRoomModal = false;
        this.deletingRoom = null;
        this.loadData();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete room';
        this.showDeleteRoomModal = false;
        this.deletingRoom = null;
        this.loading = false;
      }
    });
  }

  setRoomStatus(room: Room, status: 'Available' | 'Booked' | 'Occupied' | 'Cleaning' | 'Maintenance' | 'Reserved'): void {
    this.loading = true;
    this.error = '';
    this.success = '';
    this.api.updateRoom(room._id!, { status }).subscribe({
      next: () => {
        this.success = `Room ${room.roomNumber} status marked as '${status}'.`;
        this.loadData();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to update room status';
        this.loading = false;
      }
    });
  }

  // --- Room Type Actions ---
  openAddTypeModal(): void {
    this.editingType = null;
    this.typeForm.reset({
      name: '',
      description: '',
      basePrice: 0,
      capacity: 1,
      amenities: '',
    });
    this.showTypeModal = true;
    this.error = '';
    this.success = '';
  }

  openEditTypeModal(type: RoomType): void {
    this.editingType = type;
    this.typeForm.patchValue({
      name: type.name,
      description: type.description || '',
      basePrice: type.basePrice,
      capacity: type.capacity,
      amenities: type.amenities ? type.amenities.join(', ') : '',
    });
    this.showTypeModal = true;
    this.error = '';
    this.success = '';
  }

  saveRoomType(): void {
    if (this.typeForm.invalid) {
      this.typeForm.markAllAsTouched();
      return;
    }

    const formVal = this.typeForm.value;
    const payload = {
      ...formVal,
      basePrice: Number(formVal.basePrice),
      capacity: Number(formVal.capacity),
      amenities: formVal.amenities
        ? formVal.amenities.split(',').map((a: string) => a.trim()).filter(Boolean)
        : [],
    };

    this.loading = true;
    this.error = '';
    this.success = '';

    if (this.editingType) {
      this.api.updateRoomType(this.editingType._id!, payload).subscribe({
        next: () => {
          this.success = `Room type '${payload.name}' updated successfully!`;
          this.showTypeModal = false;
          this.loadData();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to update room type';
          this.loading = false;
        }
      });
    } else {
      this.api.createRoomType(payload).subscribe({
        next: () => {
          this.success = `Room type '${payload.name}' created successfully!`;
          this.showTypeModal = false;
          this.loadData();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to create room type';
          this.loading = false;
        }
      });
    }
  }

  confirmDeleteType(type: RoomType): void {
    this.deletingType = type;
    this.showDeleteTypeModal = true;
    this.error = '';
    this.success = '';
  }

  deleteRoomType(): void {
    if (!this.deletingType) return;
    this.loading = true;
    this.api.deleteRoomType(this.deletingType._id!).subscribe({
      next: () => {
        this.success = `Room type '${this.deletingType?.name}' deleted successfully!`;
        this.showDeleteTypeModal = false;
        this.deletingType = null;
        this.loadData();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete room type';
        this.showDeleteTypeModal = false;
        this.deletingType = null;
        this.loading = false;
      }
    });
  }

  clearAlerts(): void {
    this.error = '';
    this.success = '';
  }
}
