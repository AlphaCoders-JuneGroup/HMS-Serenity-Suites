import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BillingService,
  BillingSummary,
  PendingPaymentItem,
  RevenueReport,
} from '../../core/services/billing.service';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './billing.component.html',
  styleUrl: './billing.component.scss',
})
export class BillingComponent implements OnInit {
  summary: BillingSummary | null = null;
  pendingPayments: PendingPaymentItem[] = [];
  filteredPending: PendingPaymentItem[] = [];
  revenueReport: RevenueReport | null = null;

  loading = true;
  error = '';
  success = '';

  filterType = '';
  searchQ = '';

  reportFrom = '';
  reportTo = '';

  // Invoice viewer
  invoice: any = null;
  invoiceLoading = false;
  showInvoice = false;

  // Payment modal
  paymentItem: PendingPaymentItem | null = null;
  payAmount = 0;
  payMethod = 'Cash';
  payReference = '';
  paySubmitting = false;

  constructor(private billingService: BillingService) {}

  ngOnInit(): void {
    this.loadAll();
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);
    this.reportFrom = monthAgo.toISOString().slice(0, 10);
    this.reportTo = today.toISOString().slice(0, 10);
    this.loadRevenueReport();
  }

  loadAll(): void {
    this.loading = true;
    this.billingService.getSummary().subscribe({
      next: (res) => {
        this.summary = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load billing summary.';
        this.loading = false;
      },
    });

    this.billingService.getPendingPayments().subscribe({
      next: (res) => {
        this.pendingPayments = res.data || [];
        this.applyFilters();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load pending payments.';
      },
    });
  }

  loadRevenueReport(): void {
    this.billingService.getRevenueReport(this.reportFrom, this.reportTo).subscribe({
      next: (res) => (this.revenueReport = res.data),
      error: () => {},
    });
  }

  applyFilters(): void {
    const q = this.searchQ.trim().toLowerCase();
    this.filteredPending = this.pendingPayments.filter((p) => {
      if (this.filterType && p.type !== this.filterType) return false;
      if (q) {
        const haystack = `${p.reference} ${p.customerName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  resetFilters(): void {
    this.filterType = '';
    this.searchQ = '';
    this.applyFilters();
  }

  refresh(): void {
    this.loadAll();
    this.loadRevenueReport();
  }

  // ── Invoice viewer ────────────────────────────────────────────────────────
  viewInvoice(item: PendingPaymentItem): void {
    this.invoiceLoading = true;
    this.showInvoice = true;
    this.invoice = null;

    const request$ =
      item.type === 'Room Booking'
        ? this.billingService.getBookingInvoice(item.id)
        : item.type === 'Event'
        ? this.billingService.getEventInvoice(item.id)
        : null;

    if (!request$) {
      this.error = 'Restaurant order invoices are managed from the Restaurant module.';
      this.invoiceLoading = false;
      this.showInvoice = false;
      return;
    }

    request$.subscribe({
      next: (res) => {
        this.invoice = res.data;
        this.invoiceLoading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load invoice.';
        this.invoiceLoading = false;
        this.showInvoice = false;
      },
    });
  }

  closeInvoice(): void {
    this.showInvoice = false;
    this.invoice = null;
  }

  printInvoice(): void {
    window.print();
  }

  // ── Payment modal ──────────────────────────────────────────────────────────
  openPayment(item: PendingPaymentItem): void {
    this.paymentItem = item;
    this.payAmount = item.balance > 0 ? item.balance : item.totalAmount;
    this.payMethod = 'Cash';
    this.payReference = '';
    this.error = '';
    this.success = '';
  }

  closePayment(): void {
    this.paymentItem = null;
    this.paySubmitting = false;
  }

  submitPayment(): void {
    if (!this.paymentItem || this.payAmount <= 0) return;

    if (this.payMethod === 'Card' && !this.payReference.trim()) {
      this.error = 'Please enter the card / transaction reference.';
      return;
    }

    if (this.paymentItem.type !== 'Room Booking') {
      this.error = 'Direct payment for this type is not yet supported. Use the relevant module.';
      return;
    }

    this.paySubmitting = true;
    this.error = '';

    this.billingService
      .addPayment(this.paymentItem.id, {
        amount: this.payAmount,
        method: this.payMethod,
        note: this.payReference.trim() || undefined,
        reference: this.payReference.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.success = '✅ Payment Successful! The folio has been updated.';
          this.paySubmitting = false;
          this.closePayment();
          this.loadAll();
        },
        error: (err) => {
          this.error = err.error?.message || 'Payment failed. Please try again.';
          this.paySubmitting = false;
        },
      });
  }
}
