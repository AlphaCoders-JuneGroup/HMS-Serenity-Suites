import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  // Form fields
  name = '';
  email = '';
  password = '';
  role = '';
  phone = '';

  error = '';
  isLoading = false;

  // Available roles for signup
  roles = [
    'Admin',
    'Manager',
    'Receptionist',
    'Housekeeping Manager',
    'Restaurant Staff',
    'Event Coordinator'
  ];

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit(): void {
    if (!this.name || !this.email || !this.password || !this.role) {
      this.error = 'Please fill in all required fields (Name, Email, Password, Role).';
      return;
    }

    this.isLoading = true;
    this.error = '';

    const userData = {
      name: this.name,
      email: this.email,
      password: this.password,
      role: this.role,
      phone: this.phone
    };

    this.auth.register(userData).subscribe({
      next: () => {
        this.isLoading = false;
        // On success, token is saved and we navigate to dashboard
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err.error?.message || 'Registration failed. Please try again.';
      }
    });
  }
}
