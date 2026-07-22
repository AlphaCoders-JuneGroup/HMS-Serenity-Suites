import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { UserService, UserRole } from '../../../core/services/user.service';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent implements OnInit {
  form!: FormGroup;
  isEditMode = false;
  userId: string | null = null;
  loading = false;
  loadingUser = false;
  error = '';
  showPassword = false;

  readonly roles: UserRole[] = [
    'Admin',
    'Receptionist',
    'Manager',
    'Housekeeping Manager',
    'Restaurant Staff',
    'Event Coordinator',
  ];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.userId;

    this.buildForm();

    if (this.isEditMode) {
      this.loadUser();
    }
  }

  buildForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      // Password required only for new users; optional for edits
      password: [
        '',
        this.isEditMode ? [] : [Validators.required, Validators.minLength(6)],
      ],
      role: ['', Validators.required],
      phone: [''],
      isActive: [true],
    });
  }

  loadUser(): void {
    this.loadingUser = true;
    this.userService.getUserById(this.userId!).subscribe({
      next: (res) => {
        const u = res.data;
        this.form.patchValue({
          name: u.name,
          email: u.email,
          role: u.role,
          phone: u.phone,
          isActive: u.isActive,
        });
        this.loadingUser = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load user.';
        this.loadingUser = false;
      },
    });
  }

  get f() { return this.form.controls; }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const payload = { ...this.form.value };

    // Don't send empty password on edit
    if (this.isEditMode && !payload.password) {
      delete payload.password;
    }

    const request$ = this.isEditMode
      ? this.userService.updateUser(this.userId!, payload)
      : this.userService.createUser(payload);

    request$.subscribe({
      next: () => this.router.navigate(['/users']),
      error: (err) => {
        this.error = err.error?.message || 'Operation failed.';
        this.loading = false;
      },
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }
}
