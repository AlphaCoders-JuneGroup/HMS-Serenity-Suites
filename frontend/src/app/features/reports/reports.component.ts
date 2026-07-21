import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AnalyticsReport,
  DailyBookingsReport,
  OccupancyReport,
  PaymentsReport,
  ReportOverview,
  ReportsService,
  RevenueReport,
} from '../../core/services/reports.service';

type ReportTab = 'analytics' | 'daily' | 'revenue' | 'occupancy' | 'payments';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  tab: ReportTab = 'analytics';
  from = '';
  to = '';
  loading = false;
  error = '';

  overview: ReportOverview | null = null;
  analytics: AnalyticsReport | null = null;
  daily: DailyBookingsReport | null = null;
  revenue: RevenueReport | null = null;
  occupancy: OccupancyReport | null = null;
  payments: PaymentsReport | null = null;

  constructor(private reports: ReportsService) {}

  ngOnInit(): void {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 14);
    this.from = this.toInput(start);
    this.to = this.toInput(end);
    this.load();
  }

  setTab(tab: ReportTab): void {
    this.tab = tab;
    this.loadTab();
  }

  load(): void {
    this.error = '';
    this.loading = true;
    this.reports.getOverview(this.from, this.to).subscribe({
      next: (res) => {
        this.overview = res.data;
        this.loadTab();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load reports';
        this.loading = false;
      },
    });
  }

  private loadTab(): void {
    this.loading = true;
    this.error = '';
    const done = () => (this.loading = false);
    const fail = (err: any) => {
      this.error = err.error?.message || 'Failed to load report';
      this.loading = false;
    };

    if (this.tab === 'analytics') {
      this.reports.getAnalytics(this.from, this.to).subscribe({
        next: (res) => {
          this.analytics = res.data;
          done();
        },
        error: fail,
      });
      return;
    }
    if (this.tab === 'daily') {
      this.reports.getDailyBookings(this.from, this.to).subscribe({
        next: (res) => {
          this.daily = res.data;
          done();
        },
        error: fail,
      });
      return;
    }
    if (this.tab === 'revenue') {
      this.reports.getRevenue(this.from, this.to).subscribe({
        next: (res) => {
          this.revenue = res.data;
          done();
        },
        error: fail,
      });
      return;
    }
    if (this.tab === 'occupancy') {
      this.reports.getOccupancy(this.from, this.to).subscribe({
        next: (res) => {
          this.occupancy = res.data;
          done();
        },
        error: fail,
      });
      return;
    }
    this.reports.getPayments(this.from, this.to).subscribe({
      next: (res) => {
        this.payments = res.data;
        done();
      },
      error: fail,
    });
  }

  print(): void {
    window.print();
  }

  exportCsv(): void {
    let rows: string[][] = [];
    let filename = 'report.csv';

    if (this.tab === 'analytics' && this.analytics) {
      filename = `analytics-${this.from}-to-${this.to}.csv`;
      rows = [
        ['Date', 'Bookings Created', 'Arrivals', 'Room Revenue', 'Restaurant Revenue', 'Total Revenue', 'Occupancy %'],
        ...this.analytics.trends.map((d) => [
          d.date,
          String(d.bookingsCreated),
          String(d.arrivals),
          String(d.roomRevenue),
          String(d.restaurantRevenue),
          String(d.totalRevenue),
          String(d.occupancyPercent),
        ]),
      ];
    } else if (this.tab === 'daily' && this.daily) {
      filename = `daily-bookings-${this.from}-to-${this.to}.csv`;
      rows = [
        ['Date', 'Created', 'Arrivals', 'Departures', 'Cancelled', 'No-Show', 'Revenue Booked'],
        ...this.daily.daily.map((d) => [
          d.date,
          String(d.created),
          String(d.arrivals),
          String(d.departures),
          String(d.cancelled),
          String(d.noShow),
          String(d.revenueBooked),
        ]),
      ];
    } else if (this.tab === 'revenue' && this.revenue) {
      filename = `revenue-${this.from}-to-${this.to}.csv`;
      rows = [
        ['Date', 'Room Collected', 'Room Booked', 'Restaurant', 'Total'],
        ...this.revenue.daily.map((d) => [
          d.date,
          String(d.roomCollected),
          String(d.roomBooked),
          String(d.restaurant),
          String(d.total),
        ]),
      ];
    } else if (this.tab === 'occupancy' && this.occupancy) {
      filename = `occupancy-${this.from}-to-${this.to}.csv`;
      rows = [
        ['Date', 'Occupied', 'Available', 'Total', 'Occupancy %'],
        ...this.occupancy.daily.map((d) => [
          d.date,
          String(d.occupiedRooms),
          String(d.availableRooms),
          String(d.totalRooms),
          String(d.occupancyPercent),
        ]),
      ];
    } else if (this.tab === 'payments' && this.payments) {
      filename = `payments-${this.from}-to-${this.to}.csv`;
      rows = [
        ['Date', 'Source', 'Guest', 'Reference', 'Method', 'Amount', 'Status'],
        ...this.payments.payments.map((p) => [
          p.at ? new Date(p.at).toISOString() : '',
          p.source,
          p.guestName,
          p.reference,
          p.method,
          String(p.amount),
          p.paymentStatus,
        ]),
      ];
    }

    if (!rows.length) return;
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  methodEntries(): { key: string; value: number }[] {
    if (!this.payments?.byMethod) return [];
    return Object.entries(this.payments.byMethod).map(([key, value]) => ({ key, value }));
  }

  statusEntries(): { key: string; value: number }[] {
    if (!this.occupancy?.statusBreakdown) return [];
    return Object.entries(this.occupancy.statusBreakdown).map(([key, value]) => ({ key, value }));
  }

  private readonly chartColors = [
    '#0d9488', // teal
    '#2563eb', // blue
    '#f59e0b', // amber
    '#ec4899', // pink
    '#8b5cf6', // violet
    '#ef4444', // red
    '#10b981', // emerald
    '#f97316', // orange
  ];

  maxRevenue(): number {
    if (!this.analytics?.trends?.length) return 1;
    return Math.max(1, ...this.analytics.trends.map((t) => t.totalRevenue || 0));
  }

  maxBookings(): number {
    if (!this.analytics?.trends?.length) return 1;
    return Math.max(1, ...this.analytics.trends.map((t) => t.bookingsCreated || 0));
  }

  barHeight(value: number, max: number): number {
    if (!max) return 0;
    return Math.max(2, Math.round((value / max) * 100));
  }

  barColor(index: number): string {
    return this.chartColors[index % this.chartColors.length];
  }

  mixEntries(map?: Record<string, number>): { key: string; value: number; pct: number; color: string }[] {
    if (!map) return [];
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .map(([key, value], i) => ({
        key,
        value,
        pct: Math.round((value / total) * 1000) / 10,
        color: this.chartColors[i % this.chartColors.length],
      }));
  }

  /** CSS conic-gradient for pie charts */
  pieGradient(map?: Record<string, number>): string {
    const entries = this.mixEntries(map);
    if (!entries.length) return 'conic-gradient(#e5e7eb 0% 100%)';
    let start = 0;
    const parts = entries.map((e) => {
      const end = start + e.pct;
      const part = `${e.color} ${start}% ${end}%`;
      start = end;
      return part;
    });
    return `conic-gradient(${parts.join(', ')})`;
  }

  revenueSplitMap(): Record<string, number> {
    if (!this.analytics) return {};
    return {
      Room: this.analytics.revenueSplit.room || 0,
      Restaurant: this.analytics.revenueSplit.restaurant || 0,
    };
  }

  changeClass(change: number): string {
    if (change > 0) return 'text-emerald-600';
    if (change < 0) return 'text-rose-600';
    return 'text-gray-500';
  }

  changeLabel(change: number): string {
    const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
    return `${arrow} ${Math.abs(change)}%`;
  }

  private toInput(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
