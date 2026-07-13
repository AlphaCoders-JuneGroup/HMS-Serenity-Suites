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

  // Letters, spaces, hyphens, apostrophes
  private readonly namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s'-]{0,48}$/;
  // Digits with optional +, spaces, dashes, parentheses
  private readonly phonePattern = /^\+?[\d\s\-()]{7,20}$/;
  private readonly zipPattern = /^[A-Za-z0-9\s-]{0,12}$/;

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
        firstName: [
          '',
          [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(50),
            Validators.pattern(this.namePattern),
          ],
        ],
        lastName: [
          '',
          [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(50),
            Validators.pattern(this.namePattern),
          ],
        ],
        email: [
          '',
          [Validators.required, Validators.email, Validators.maxLength(100)],
        ],
        phone: [
          '',
          [
            Validators.required,
            Validators.pattern(this.phonePattern),
            Validators.minLength(7),
            Validators.maxLength(20),
          ],
        ],
        nationality: ['', [Validators.maxLength(60), Validators.pattern(/^[A-Za-z\s'-]*$/)]],
        idType: [''],
        idNumber: ['', [Validators.maxLength(40), Validators.pattern(/^[A-Za-z0-9\-\s]*$/)]],
        street: ['', Validators.maxLength(120)],
        city: ['', [Validators.maxLength(60), Validators.pattern(/^[A-Za-z\s'-]*$/)]],
        state: ['', [Validators.maxLength(60), Validators.pattern(/^[A-Za-z\s'-]*$/)]],
        country: ['', [Validators.maxLength(60), Validators.pattern(/^[A-Za-z\s'-]*$/)]],
        zipCode: ['', [Validators.maxLength(12), Validators.pattern(this.zipPattern)]],
      },
      { validators: idNumberRequiredWhenType }
    );

    this.form.get('idType')?.valueChanges.subscribe(() => {
      this.form.updateValueAndValidity({ emitEvent: false });
      this.form.get('idNumber')?.updateValueAndValidity({ emitEvent: false });
    });
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
      phone: v.phone.trim(),
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
        this.error = err.error?.message || 'Failed to save guest';
        this.loading = false;
      },
    });
  }

  get f() {
    return this.form.controls;
  }
}
