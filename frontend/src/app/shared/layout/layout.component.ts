import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  roles: string[]; // empty = all roles
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  constructor(public auth: AuthService) {}

  /**
   * All nav items with their allowed roles.
   * Empty roles array = accessible by all authenticated users.
   */
  allNavItems: NavItem[] = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: '📊',
      roles: [],
    },
    {
      path: '/guests',
      label: 'Guest Management',
      icon: '👥',
      roles: ['Admin', 'Manager', 'Receptionist'],
    },
    {
      path: '/rooms',
      label: 'Room Management',
      icon: '🛏️',
      roles: ['Admin', 'Manager', 'Receptionist', 'Housekeeping Manager'],
    },
    {
      path: '/bookings',
      label: 'Booking Management',
      icon: '📅',
      roles: ['Admin', 'Manager', 'Receptionist'],
    },
    {
      path: '/check-in',
      label: 'Check-in / Check-out',
      icon: '🔑',
      roles: ['Admin', 'Manager', 'Receptionist'],
    },
    {
      path: '/billing',
      label: 'Billing & Payments',
      icon: '💳',
      roles: ['Admin', 'Manager', 'Receptionist'],
    },
    {
      path: '/restaurant',
      label: 'Restaurant',
      icon: '🍽️',
      roles: ['Admin', 'Manager', 'Restaurant Staff'],
    },
    {
      path: '/housekeeping',
      label: 'Housekeeping',
      icon: '🧹',
      roles: ['Admin', 'Manager', 'Housekeeping Manager'],
    },
    {
      path: '/events',
      label: 'Event Management',
      icon: '🎉',
      roles: ['Admin', 'Manager', 'Event Coordinator'],
    },
    {
      path: '/reports',
      label: 'Reporting & Analytics',
      icon: '📈',
      roles: ['Admin', 'Manager'],
    },
  ];

  // Admin-only items shown in a separate section
  adminNavItems: NavItem[] = [
    {
      path: '/users',
      label: 'User Management',
      icon: '🔐',
      roles: ['Admin'],
    },
  ];

  /** Returns only the nav items the current user's role is allowed to see */
  get visibleNavItems(): NavItem[] {
    const role = this.auth.getRole();
    return this.allNavItems.filter(
      (item) => item.roles.length === 0 || (role && item.roles.includes(role))
    );
  }

  logout(): void {
    this.auth.logout();
  }
}
