import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

interface DashboardModule {
  path: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  roles: string[];
}

interface RoomLike {
  status?: string;
}

interface BookingLike {
  status?: string;
  checkIn?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  roomCount = 0;
  availableRooms = 0;
  guestCount = 0;
  bookingCount = 0;
  todayCheckIns = 0;
  today = new Date();

  private allModules: DashboardModule[] = [
    {
      path: '/guests',
      title: 'Guest Management',
      description: 'Manage guest profiles and contact details',
      icon: '👥',
      accent: 'bg-green-50 text-green-600',
      roles: ['Admin', 'Manager', 'Receptionist'],
    },
    {
      path: '/rooms',
      title: 'Room Management',
      description: 'Manage rooms, types, and availability',
      icon: '🛏️',
      accent: 'bg-serenity-50 text-serenity-700',
      roles: ['Admin', 'Manager', 'Receptionist', 'Housekeeping Manager'],
    },
    {
      path: '/bookings',
      title: 'Booking Management',
      description: 'Create and track reservations',
      icon: '📅',
      accent: 'bg-violet-50 text-violet-600',
      roles: ['Admin', 'Manager', 'Receptionist'],
    },
    {
      path: '/check-in',
      title: 'Check-in / Check-out',
      description: 'Handle arrivals and departures',
      icon: '🔑',
      accent: 'bg-amber-50 text-amber-600',
      roles: ['Admin', 'Manager', 'Receptionist'],
    },
    {
      path: '/billing',
      title: 'Billing & Payments',
      description: 'Invoices, payments, and guest folios',
      icon: '💳',
      accent: 'bg-emerald-50 text-emerald-600',
      roles: ['Admin', 'Manager', 'Receptionist'],
    },
    {
      path: '/restaurant',
      title: 'Restaurant Management',
      description: 'Menus, orders, and dining services',
      icon: '🍽️',
      accent: 'bg-orange-50 text-orange-600',
      roles: ['Admin', 'Manager', 'Restaurant Staff'],
    },
    {
      path: '/housekeeping',
      title: 'Housekeeping Management',
      description: 'Room status and cleaning tasks',
      icon: '🧹',
      accent: 'bg-cyan-50 text-cyan-600',
      roles: ['Admin', 'Manager', 'Housekeeping Manager'],
    },
    {
      path: '/events',
      title: 'Event Management',
      description: 'Events, conferences, and venues',
      icon: '🎉',
      accent: 'bg-pink-50 text-pink-600',
      roles: ['Admin', 'Manager', 'Event Coordinator'],
    },
    {
      path: '/reports',
      title: 'Reporting & Analytics',
      description: 'Occupancy, revenue, and insights',
      icon: '📈',
      accent: 'bg-indigo-50 text-indigo-600',
      roles: ['Admin', 'Manager'],
    },
  ];

  constructor(
    private api: ApiService,
    public auth: AuthService
  ) {}

  get modules(): DashboardModule[] {
    const role = this.auth.getRole();
    return this.allModules.filter((m) => role && m.roles.includes(role));
  }

  get firstName(): string {
    const name = this.auth.currentUser()?.name?.trim();
    if (!name) return 'there';
    return name.split(/\s+/)[0] || 'there';
  }

  get initials(): string {
    return this.auth.currentUser()?.name?.charAt(0)?.toUpperCase() || '?';
  }

  get greeting(): string {
    const hour = this.today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  get occupancyRate(): number {
    if (!this.roomCount) return 0;
    return Math.round(((this.roomCount - this.availableRooms) / this.roomCount) * 100);
  }

  private isSameDay(dateStr?: string): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return (
      d.getFullYear() === this.today.getFullYear() &&
      d.getMonth() === this.today.getMonth() &&
      d.getDate() === this.today.getDate()
    );
  }

  ngOnInit(): void {
    this.api.getRooms().subscribe({
      next: (res) => {
        const rooms = (res.data ?? []) as RoomLike[];
        this.roomCount = res.count ?? rooms.length;
        this.availableRooms = rooms.filter((r) => r.status === 'Available').length;
      },
      error: () => {
        this.roomCount = 0;
        this.availableRooms = 0;
      },
    });

    this.api.getGuests().subscribe({
      next: (res) => (this.guestCount = res.count ?? 0),
      error: () => (this.guestCount = 0),
    });

    this.api.getBookings().subscribe({
      next: (res) => {
        const bookings = (res.data ?? []) as BookingLike[];
        this.bookingCount = res.count ?? bookings.length;
        this.todayCheckIns = bookings.filter(
          (b) =>
            this.isSameDay(b.checkIn) &&
            b.status !== 'Cancelled' &&
            b.status !== 'Checked-Out'
        ).length;
      },
      error: () => {
        this.bookingCount = 0;
        this.todayCheckIns = 0;
      },
    });
  }
}
