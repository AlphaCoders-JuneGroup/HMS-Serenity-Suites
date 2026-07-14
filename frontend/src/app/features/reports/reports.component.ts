import { Component, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BookingService, ReportSummary } from '../../core/services/booking.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CurrencyPipe, FormsModule, RouterLink],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  data: ReportSummary | null = null;
  from = '';
  to = '';
  loading = true;
  error = '';

  constructor(private bookingService: BookingService) {}

  ngOnInit(): void {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    this.from = this.toInput(start);
    this.to = this.toInput(end);
    this.load();
  }

  load(): void {
    this.loading = true;
    this.bookingService.getReportSummary(this.from, this.to).subscribe({
      next: (res) => {
        this.data = res.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load reports';
        this.loading = false;
      },
    });
  }

  private toInput(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
