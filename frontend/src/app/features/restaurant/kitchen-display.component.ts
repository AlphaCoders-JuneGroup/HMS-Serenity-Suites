import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OrderStatus, RestaurantOrder, RestaurantService } from '../../core/services/restaurant.service';

@Component({
  selector: 'app-kitchen-display',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './kitchen-display.component.html',
  styleUrl: './kitchen-display.component.scss',
})
export class KitchenDisplayComponent implements OnInit, OnDestroy {
  orders: RestaurantOrder[] = [];
  error = '';
  private pollTimer: any;
  lastUpdated = new Date();

  columns: { status: OrderStatus; title: string }[] = [
    { status: 'Pending', title: 'New' },
    { status: 'Preparing', title: 'Cooking' },
    { status: 'Ready', title: 'Ready' },
  ];

  constructor(
    private restaurant: RestaurantService,
    private auth: AuthService
  ) {}

  get canManage(): boolean {
    return this.auth.hasRole('Admin', 'Restaurant Staff');
  }

  ordersFor(status: OrderStatus): RestaurantOrder[] {
    return this.orders.filter((o) => o.status === status);
  }

  load(): void {
    this.restaurant.getKitchen().subscribe({
      next: (res) => {
        this.orders = res.data ?? [];
        this.lastUpdated = new Date();
        this.error = '';
      },
      error: (err) => (this.error = err.error?.message || 'Failed to load kitchen queue'),
    });
  }

  setStatus(order: RestaurantOrder, status: OrderStatus): void {
    if (!this.canManage || !order._id) return;
    this.restaurant.updateOrderStatus(order._id, status).subscribe({
      next: () => this.load(),
      error: (err) => (this.error = err.error?.message || 'Failed to update status'),
    });
  }

  waitMinutes(order: RestaurantOrder): number {
    if (!order.createdAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  }

  ngOnInit(): void {
    this.load();
    this.pollTimer = setInterval(() => this.load(), 8000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
}
