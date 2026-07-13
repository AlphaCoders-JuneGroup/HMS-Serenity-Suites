import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/layout/layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { RoomsComponent } from './features/rooms/rooms.component';
import { GuestsComponent } from './features/guests/guests.component';
import { GuestFormComponent } from './features/guests/guest-form/guest-form.component';
import { GuestProfileComponent } from './features/guests/guest-profile/guest-profile.component';
import { BookingsComponent } from './features/bookings/bookings.component';
import { BookingFormComponent } from './features/bookings/booking-form/booking-form.component';
import { ModulePageComponent } from './features/module-page/module-page.component';
import { RestaurantComponent } from './features/restaurant/restaurant.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { UnauthorizedComponent } from './features/auth/unauthorized/unauthorized.component';
import { UserListComponent } from './features/users/user-list/user-list.component';
import { UserFormComponent } from './features/users/user-form/user-form.component';
import { HousekeepingComponent } from './features/housekeeping/housekeeping.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * Role-Based Access Control Matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * Route              | Admin | Manager | Receptionist | HK Mgr | Rest | Event
 * ─────────────────────────────────────────────────────────────────────────────
 * /dashboard         |  ✅   |   ✅    |     ✅       |   ✅   |  ✅  |  ✅
 * /guests            |  ✅   |  view   |     ✅       |   ❌   |  ❌  |  ❌
 * /guests/new|edit   |  ✅   |   ❌    |     ✅       |   ❌   |  ❌  |  ❌
 * /rooms             |  ✅   |   ✅    |     ✅       |   ✅   |  ❌  |  ❌
 * /bookings          |  ✅   |  view   |     ✅       |   ❌   |  ❌  |  ❌
 * /bookings/new|edit |  ✅   |   ❌    |     ✅       |   ❌   |  ❌  |  ❌
 * /check-in          |  ✅   |   ✅    |     ✅       |   ❌   |  ❌  |  ❌
 * /billing           |  ✅   |   ✅    |     ✅       |   ❌   |  ❌  |  ❌
 * /restaurant        |  ✅   |   ✅    |     ❌       |   ❌   |  ✅  |  ❌
 * /housekeeping      |  ✅   |   ✅    |     ❌       |   ✅   |  ❌  |  ❌
 * /events            |  ✅   |   ✅    |     ❌       |   ❌   |  ❌  |  ✅
 * /reports           |  ✅   |   ✅    |     ❌       |   ❌   |  ❌  |  ❌
 * /users             |  ✅   |   ❌    |     ❌       |   ❌   |  ❌  |  ❌
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const routes: Routes = [
  // ── Public routes ──────────────────────────────────────────────────────────
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'unauthorized', component: UnauthorizedComponent },

  // ── Protected routes (all require a valid JWT) ────────────────────────────
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      { path: 'dashboard', component: DashboardComponent },

      // 2. Guest Management (Manager = view only)
      {
        path: 'guests',
        canActivate: [roleGuard('Admin', 'Manager', 'Receptionist')],
        component: GuestsComponent,
      },
      {
        path: 'guests/new',
        canActivate: [roleGuard('Admin', 'Receptionist')],
        component: GuestFormComponent,
      },
      {
        path: 'guests/edit/:id',
        canActivate: [roleGuard('Admin', 'Receptionist')],
        component: GuestFormComponent,
      },
      {
        path: 'guests/:id',
        canActivate: [roleGuard('Admin', 'Manager', 'Receptionist')],
        component: GuestProfileComponent,
      },

      // 3. Room Management
      {
        path: 'rooms',
        canActivate: [roleGuard('Admin', 'Manager', 'Receptionist', 'Housekeeping Manager')],
        component: RoomsComponent,
      },

      // 4. Booking Management (Manager = view only)
      {
        path: 'bookings',
        canActivate: [roleGuard('Admin', 'Manager', 'Receptionist')],
        component: BookingsComponent,
      },
      {
        path: 'bookings/new',
        canActivate: [roleGuard('Admin', 'Receptionist')],
        component: BookingFormComponent,
      },
      {
        path: 'bookings/edit/:id',
        canActivate: [roleGuard('Admin', 'Receptionist')],
        component: BookingFormComponent,
      },

      // 5. Check-in / Check-out Management
      {
        path: 'check-in',
        canActivate: [roleGuard('Admin', 'Manager', 'Receptionist')],
        component: ModulePageComponent,
        data: {
          title: 'Check-in / Check-out Management',
          description: 'Manage guest arrivals, departures, and room assignments',
          icon: '🔑',
          moduleKey: 'check-in',
        },
      },

      // 6. Billing & Payment Management
      {
        path: 'billing',
        canActivate: [roleGuard('Admin', 'Manager', 'Receptionist')],
        component: ModulePageComponent,
        data: {
          title: 'Billing & Payment Management',
          description: 'Handle invoices, payments, and guest folios',
          icon: '💳',
          moduleKey: 'billing',
        },
      },

      // 7. Restaurant Management (Manager = view only)
      {
        path: 'restaurant',
        canActivate: [roleGuard('Admin', 'Manager', 'Restaurant Staff')],
        component: RestaurantComponent,
      },

      // 8. Housekeeping Management
      {
        path: 'housekeeping',
        canActivate: [roleGuard('Admin', 'Manager', 'Housekeeping Manager')],
        component: HousekeepingComponent,
      },

      // 9. Event Management
      {
        path: 'events',
        canActivate: [roleGuard('Admin', 'Manager', 'Event Coordinator')],
        component: ModulePageComponent,
        data: {
          title: 'Event Management',
          description: 'Plan and manage hotel events and conferences',
          icon: '🎉',
          moduleKey: 'events',
        },
      },

      // 10. Reporting & Analytics
      {
        path: 'reports',
        canActivate: [roleGuard('Admin', 'Manager')],
        component: ModulePageComponent,
        data: {
          title: 'Reporting & Analytics',
          description: 'View occupancy, revenue, and performance reports',
          icon: '📈',
          moduleKey: 'reports',
        },
      },

      // ── User Management: Admin only ────────────────────────────────────────
      {
        path: 'users',
        canActivate: [roleGuard('Admin')],
        component: UserListComponent,
      },
      {
        path: 'users/new',
        canActivate: [roleGuard('Admin')],
        component: UserFormComponent,
      },
      {
        path: 'users/edit/:id',
        canActivate: [roleGuard('Admin')],
        component: UserFormComponent,
      },
    ],
  },

  { path: '**', redirectTo: 'dashboard' },
];
