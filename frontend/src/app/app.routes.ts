import { Routes } from '@angular/router';
import { LayoutComponent } from './shared/layout/layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { RoomsComponent } from './features/rooms/rooms.component';
import { GuestsComponent } from './features/guests/guests.component';
import { BookingsComponent } from './features/bookings/bookings.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { UnauthorizedComponent } from './features/auth/unauthorized/unauthorized.component';
import { UserListComponent } from './features/users/user-list/user-list.component';
import { UserFormComponent } from './features/users/user-form/user-form.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

/**
 * Role-Based Access Control Matrix
 * ─────────────────────────────────────────────────────────────────────────────
 * Route              | Admin | Manager | Receptionist | HK Mgr | Rest | Event
 * ─────────────────────────────────────────────────────────────────────────────
 * /dashboard         |  ✅   |   ✅    |     ✅       |   ✅   |  ✅  |  ✅
 * /users             |  ✅   |   ❌    |     ❌       |   ❌   |  ❌  |  ❌
 * /rooms             |  ✅   |   ✅    |     ✅       |   ✅   |  ❌  |  ❌
 * /guests            |  ✅   |   ✅    |     ✅       |   ❌   |  ❌  |  ❌
 * /bookings          |  ✅   |   ✅    |     ✅       |   ❌   |  ❌  |  ❌
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

      // ── All roles can access the dashboard ────────────────────────────────
      { path: 'dashboard', component: DashboardComponent },

      // ── Room & Housekeeping: Admin, Manager, Receptionist, Housekeeping Mgr
      {
        path: 'rooms',
        canActivate: [roleGuard('Admin', 'Manager', 'Receptionist', 'Housekeeping Manager')],
        component: RoomsComponent,
      },

      // ── Guests: Admin, Manager, Receptionist
      {
        path: 'guests',
        canActivate: [roleGuard('Admin', 'Manager', 'Receptionist')],
        component: GuestsComponent,
      },

      // ── Bookings: Admin, Manager, Receptionist
      {
        path: 'bookings',
        canActivate: [roleGuard('Admin', 'Manager', 'Receptionist')],
        component: BookingsComponent,
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
