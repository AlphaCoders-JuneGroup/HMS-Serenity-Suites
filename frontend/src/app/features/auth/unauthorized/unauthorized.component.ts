import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center p-8 max-w-md">
        <div class="text-7xl mb-6">🚫</div>
        <h1 class="text-3xl font-bold text-gray-800 mb-2">Access Denied</h1>
        <p class="text-gray-500 mb-2">
          Your role <span class="font-semibold text-serenity-700">"{{ auth.getRole() }}"</span> does not have permission to view this page.
        </p>
        <p class="text-gray-400 text-sm mb-8">Please contact your Admin if you believe this is a mistake.</p>
        <a routerLink="/dashboard" class="btn-primary inline-block">← Back to Dashboard</a>
      </div>
    </div>
  `,
})
export class UnauthorizedComponent {
  constructor(public auth: AuthService) {}
}
