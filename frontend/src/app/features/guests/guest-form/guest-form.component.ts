import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GuestService } from '../../../core/services/guest.service';
import {
  guestEmailValidator,
  guestNameValidator,
  sriLankanPhoneValidator,
} from '../../../core/validators/guest-field.validators';

/** Require ID number when an ID type is selected */
function idNumberRequiredWhenType(group: AbstractControl): ValidationErrors | null {
  const idType = group.get('idType')?.value;
  const idNumber = (group.get('idNumber')?.value || '').trim();
  if (idType && !idNumber) {
    group.get('idNumber')?.setErrors({ requiredWhenType: true });
    return { idNumberRequired: true };
  }
  const ctrl = group.get('idNumber');
  if (ctrl?.hasError('requiredWhenType')) {
    const { requiredWhenType: _, ...rest } = ctrl.errors || {};
    ctrl.setErrors(Object.keys(rest).length ? rest : null);
  }
  return null;
}

@Component({
  selector: 'app-guest-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './guest-form.component.html',
})
export class GuestFormComponent implements OnInit {
  form!: FormGroup;
  isEditMode = false;
  guestId: string | null = null;
  loading = false;
  loadingGuest = false;
  submitted = false;
  error = '';

  readonly idTypes = ['Passport', 'National ID', 'Driving License'];

  constructor(
    private fb: FormBuilder,
    private guestService: GuestService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.guestId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.guestId;
    this.buildForm();
    if (this.isEditMode) this.loadGuest();
  }

  buildForm(): void {
    this.form = this.fb.group(
      {
        firstName: ['', [guestNameValidator()]],
        lastName: ['', [guestNameValidator()]],
        email: ['', [guestEmailValidator()]],
        phone: ['', [sriLankanPhoneValidator()]],
        nationality: ['', [Validators.maxLength(60), Validators.pattern(/^[A-Za-z\s'-]*$/)]],
        idType: [''],
        idNumber: ['', [Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9\-\s]*$/)]],
        street: ['', Validators.maxLength(120)],
        city: ['', [Validators.maxLength(60), Validators.pattern(/^[A-Za-z\s'-]*$/)]],
        state: ['', [Validators.maxLength(60), Validators.pattern(/^[A-Za-z\s'-]*$/)]],
        country: ['', [Validators.maxLength(60), Validators.pattern(/^[A-Za-z\s'-]*$/)]],
        zipCode: ['', [Validators.maxLength(12), Validators.pattern(/^[A-Za-z0-9\s-]*$/)]],
      },
      { validators: idNumberRequiredWhenType }
    );

    this.form.get('idType')?.valueChanges.subscribe(() => {
      this.form.updateValueAndValidity({ emitEvent: false });
      this.form.get('idNumber')?.updateValueAndValidity({ emitEvent: false });
    });
  }

  /** Keep phone digits-only while typing (max 10) */
  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    if (input.value !== digits) {
      this.form.get('phone')?.setValue(digits, { emitEvent: true });
      input.value = digits;
    }
  }

  loadGuest(): void {
    this.loadingGuest = true;
    this.guestService.getGuestById(this.guestId!).subscribe({
      next: (res) => {
        const g = res.data;
        this.form.patchValue({
          firstName: g.firstName,
          lastName: g.lastName,
          email: g.email,
          phone: g.phone,
          nationality: g.nationality || '',
          idType: g.idType || '',
          idNumber: g.idNumber || '',
          street: g.address?.street || '',
          city: g.address?.city || '',
          state: g.address?.state || '',
          country: g.address?.country || '',
          zipCode: g.address?.zipCode || '',
        });
        this.loadingGuest = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load guest';
        this.loadingGuest = false;
      },
    });
  }

  showError(controlName: string): boolean {
    const ctrl = this.f[controlName];
    return !!ctrl && ctrl.invalid && (ctrl.touched || this.submitted);
  }

  phoneErrorMessage(): string {
    const errors = this.f['phone'].errors;
    if (!errors) return '';
    if (errors['required']) return 'Phone number is required.';
    if (errors['empty']) return 'Please enter a phone number.';
    if (errors['digitsOnly']) return 'Phone number must contain only numbers.';
    if (errors['length']) return 'Phone number must be exactly 10 digits.';
    if (errors['startsWithZero']) return 'Phone number must start with 0.';
    if (errors['invalidFormat']) return 'Please enter a valid phone number.';
    if (errors['duplicate']) return 'This phone number is already registered.';
    return 'Please enter a valid phone number.';
  }

  emailErrorMessage(): string {
    const errors = this.f['email'].errors;
    if (!errors) return '';
    if (errors['required']) return 'Email is required.';
    if (errors['empty']) return 'Please enter an email address.';
    if (errors['invalidFormat'] || errors['email']) return 'Please enter a valid email address.';
    if (errors['maxlength']) return 'Email must be at most 100 characters.';
    if (errors['duplicate']) return 'This email is already registered.';
    return 'Please enter a valid email address.';
  }

  nameErrorMessage(controlName: 'firstName' | 'lastName'): string {
    const label = controlName === 'firstName' ? 'First name' : 'Last name';
    const errors = this.f[controlName].errors;
    if (!errors) return '';
    if (errors['required']) return `${label} is required.`;
    if (errors['empty']) return `Please enter a ${label.toLowerCase()}.`;
    if (errors['minlength']) return `${label} must be at least 2 characters.`;
    if (errors['maxlength']) return `${label} must be at most 50 characters.`;
    if (errors['pattern']) return `${label} must contain only letters (spaces, - and ' allowed).`;
    return `Please enter a valid ${label.toLowerCase()}.`;
  }

  onSubmit(): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();

    if (this.form.invalid) {
      this.error = 'Please fix the highlighted fields before saving.';
      return;
    }

    this.loading = true;
    this.error = '';
    const v = this.form.value;
    const payload = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim().toLowerCase(),
      phone: String(v.phone).trim(),
      nationality: v.nationality?.trim() || undefined,
      idType: v.idType || undefined,
      idNumber: v.idNumber?.trim() || undefined,
      address: {
        street: v.street?.trim() || undefined,
        city: v.city?.trim() || undefined,
        state: v.state?.trim() || undefined,
        country: v.country?.trim() || undefined,
        zipCode: v.zipCode?.trim() || undefined,
      },
    };

    const req$ = this.isEditMode
      ? this.guestService.updateGuest(this.guestId!, payload)
      : this.guestService.createGuest(payload);

    req$.subscribe({
      next: (res) => {
        this.loading = false;
        const id = res.data._id;
        this.router.navigate(id ? ['/guests', id] : ['/guests']);
      },
      error: (err) => {
        const msg = err.error?.message || 'Failed to save guest';
        this.error = msg;
        this.loading = false;

        if (/phone number is already registered/i.test(msg)) {
          this.f['phone'].setErrors({ ...(this.f['phone'].errors || {}), duplicate: true });
        }
        if (/email already exists|email is already registered/i.test(msg)) {
          this.f['email'].setErrors({ ...(this.f['email'].errors || {}), duplicate: true });
        }
      },
    });
  }

  get f() {
    return this.form.controls;
  }
}
