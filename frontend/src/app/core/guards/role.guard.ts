import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * roleGuard — Factory function that checks if the current user has
 * one of the allowed roles. Redirects to /unauthorized if not.
 *
 * Usage in routes:
 *   canActivate: [authGuard, roleGuard('Admin')]
 *   canActivate: [authGuard, roleGuard('Admin', 'Manager')]
 */
export const roleGuard = (...allowedRoles: string[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasRole(...allowedRoles)) {
      return true;
    }

    router.navigate(['/unauthorized']);
    return false;
  };
};
