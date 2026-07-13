import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Sri Lankan local phone: required, digits only, exactly 10, starts with 0 */
export function sriLankanPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;

    if (raw === null || raw === undefined) {
      return { required: true };
    }

    const value = String(raw);

    if (value === '') {
      return { required: true };
    }

    if (value.trim() === '') {
      return { empty: true };
    }

    if (!/^\d+$/.test(value)) {
      return { digitsOnly: true };
    }

    if (value.length !== 10) {
      return { length: true };
    }

    if (!value.startsWith('0')) {
      return { startsWithZero: true };
    }

    if (!/^0\d{9}$/.test(value)) {
      return { invalidFormat: true };
    }

    return null;
  };
}

/** Email: required / empty / format (duplicate handled via API) */
export function guestEmailValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;

    if (raw === null || raw === undefined) {
      return { required: true };
    }

    const value = String(raw);

    if (value === '') {
      return { required: true };
    }

    if (value.trim() === '') {
      return { empty: true };
    }

    const email = value.trim();
    // Practical email pattern (not overly strict)
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailPattern.test(email) || /\s/.test(value)) {
      return { invalidFormat: true };
    }

    if (email.length > 100) {
      return { maxlength: { requiredLength: 100, actualLength: email.length } };
    }

    return null;
  };
}

/** Letters-only name (spaces, hyphen, apostrophe allowed) */
export function guestNameValidator(min = 2, max = 50): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;

    if (raw === null || raw === undefined || String(raw) === '') {
      return { required: true };
    }

    const value = String(raw);

    if (value.trim() === '') {
      return { empty: true };
    }

    const trimmed = value.trim();
    if (trimmed.length < min) {
      return { minlength: { requiredLength: min, actualLength: trimmed.length } };
    }
    if (trimmed.length > max) {
      return { maxlength: { requiredLength: max, actualLength: trimmed.length } };
    }

    const namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s'-]*$/;
    if (!namePattern.test(trimmed) || /[^A-Za-zÀ-ÖØ-öø-ÿ\s'-]/.test(trimmed)) {
      return { pattern: true };
    }

    return null;
  };
}
