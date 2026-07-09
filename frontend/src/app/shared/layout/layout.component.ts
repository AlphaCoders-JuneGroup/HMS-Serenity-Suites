import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss',
})
export class LayoutComponent {
  navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/rooms', label: 'Rooms', icon: '🛏️' },
    { path: '/guests', label: 'Guests', icon: '👥' },
    { path: '/bookings', label: 'Bookings', icon: '📅' },
  ];
}
