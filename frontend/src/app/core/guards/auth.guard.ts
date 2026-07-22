import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * authGuard — Redirects unauthenticated users to /login.
 * Apply to all routes that require a login.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  // Store the attempted URL for redirect after login
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
