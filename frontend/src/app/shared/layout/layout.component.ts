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
      roles: [], // all roles
    },
    {
      path: '/rooms',
      label: 'Rooms',
      icon: '🛏️',
      roles: ['Admin', 'Manager', 'Receptionist', 'Housekeeping Manager'],
    },
    {
      path: '/guests',
      label: 'Guests',
      icon: '👥',
      roles: ['Admin', 'Manager', 'Receptionist'],
    },
    {
      path: '/bookings',
      label: 'Bookings',
      icon: '📅',
      roles: ['Admin', 'Manager', 'Receptionist'],
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
