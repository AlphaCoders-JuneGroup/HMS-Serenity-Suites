import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import {
  DailySales,
  MenuCategory,
  MenuItem,
  OrderStatus,
  OrderType,
  RestaurantOrder,
  RestaurantService,
} from '../../core/services/restaurant.service';

type Tab = 'menu' | 'orders' | 'new-order' | 'sales';

@Component({
  selector: 'app-restaurant',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './restaurant.component.html',
  styleUrl: './restaurant.component.scss',
})
export class RestaurantComponent implements OnInit {
  tab: Tab = 'orders';
  menu: MenuItem[] = [];
  orders: RestaurantOrder[] = [];
  sales: DailySales | null = null;
  salesDate = new Date().toISOString().slice(0, 10);

  loading = true;
  error = '';
  success = '';

  // Menu form
  showMenuForm = false;
  editingMenuId: string | null = null;
  menuForm = {
    name: '',
    description: '',
    category: 'Food' as MenuCategory,
    price: 0,
    available: true,
    preparationTime: 15,
  };

  // New order
  cart: { item: MenuItem; quantity: number }[] = [];
  orderType: OrderType = 'Dine-In';
  roomNumber = '';
  guestName = '';
  notes = '';
  orderFilter = '';
  receiptOrder: RestaurantOrder | null = null;
  showReceipt = false;

  categories: MenuCategory[] = ['Food', 'Beverage', 'Dessert', 'Special'];
  orderTypes: OrderType[] = ['Dine-In', 'Room Service', 'Takeaway'];
  statuses: OrderStatus[] = ['Pending', 'Preparing', 'Ready', 'Served', 'Billed', 'Cancelled'];

  constructor(
    private restaurant: RestaurantService,
    private auth: AuthService
  ) {}

  get canManage(): boolean {
    return this.auth.hasRole('Admin', 'Restaurant Staff');
  }

  get availableMenu(): MenuItem[] {
    return this.menu.filter((m) => m.available);
  }

  get cartTotal(): number {
    return this.cart.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  }

  get pendingOrders(): number {
    return this.orders.filter((o) =>
      ['Pending', 'Preparing', 'Ready'].includes(o.status)
    ).length;
  }

  get roomServiceCount(): number {
    return this.orders.filter((o) => o.orderType === 'Room Service').length;
  }

  get filteredOrders(): RestaurantOrder[] {
    if (!this.orderFilter) return this.orders;
    return this.orders.filter((o) => o.status === this.orderFilter);
  }

  get salesByTypeEntries(): { key: string; value: number }[] {
    if (!this.sales?.byType) return [];
    return Object.entries(this.sales.byType).map(([key, value]) => ({ key, value }));
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    this.error = '';
    this.success = '';
    if (tab === 'sales') this.loadSales();
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Ready':
      case 'Served':
        return 'badge-success';
      case 'Preparing':
        return 'badge-info';
      case 'Billed':
        return 'badge-neutral';
      case 'Cancelled':
        return 'badge-danger';
      default:
        return 'badge-warning';
    }
  }

  loadAll(): void {
    this.loading = true;
    this.restaurant.getMenu().subscribe({
      next: (res) => {
        this.menu = res.data ?? [];
        this.restaurant.getOrders().subscribe({
          next: (orderRes) => {
            this.orders = orderRes.data ?? [];
            this.loading = false;
          },
          error: (err) => {
            this.error = err.error?.message || 'Failed to load orders';
            this.loading = false;
          },
        });
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load menu';
        this.loading = false;
      },
    });
  }

  loadSales(): void {
    this.restaurant.getDailySales(this.salesDate).subscribe({
      next: (res) => (this.sales = res.data),
      error: (err) => (this.error = err.error?.message || 'Failed to load sales'),
    });
  }

  openMenuForm(item?: MenuItem): void {
    if (!this.canManage) return;
    this.showMenuForm = true;
    if (item) {
      this.editingMenuId = item._id || null;
      this.menuForm = {
        name: item.name,
        description: item.description || '',
        category: item.category,
        price: item.price,
        available: item.available,
        preparationTime: item.preparationTime || 15,
      };
    } else {
      this.editingMenuId = null;
      this.menuForm = {
        name: '',
        description: '',
        category: 'Food',
        price: 0,
        available: true,
        preparationTime: 15,
      };
    }
  }

  saveMenuItem(): void {
    if (!this.canManage) return;
    if (!this.menuForm.name.trim() || this.menuForm.price < 0) {
      this.error = 'Menu name and a valid price are required.';
      return;
    }

    const payload = { ...this.menuForm, name: this.menuForm.name.trim() };
    const req$ = this.editingMenuId
      ? this.restaurant.updateMenuItem(this.editingMenuId, payload)
      : this.restaurant.createMenuItem(payload);

    req$.subscribe({
      next: () => {
        this.success = this.editingMenuId ? 'Menu item updated.' : 'Menu item added.';
        this.showMenuForm = false;
        this.loadAll();
      },
      error: (err) => (this.error = err.error?.message || 'Failed to save menu item'),
    });
  }

  toggleAvailability(item: MenuItem): void {
    if (!this.canManage || !item._id) return;
    this.restaurant.toggleAvailability(item._id).subscribe({
      next: (res) => {
        item.available = res.data.available;
        this.success = `"${item.name}" marked ${item.available ? 'available' : 'unavailable'}.`;
      },
      error: (err) => (this.error = err.error?.message || 'Failed to update availability'),
    });
  }

  deleteMenuItem(item: MenuItem): void {
    if (!this.canManage || !item._id) return;
    if (!confirm(`Delete "${item.name}" from the menu?`)) return;
    this.restaurant.deleteMenuItem(item._id).subscribe({
      next: () => {
        this.success = 'Menu item deleted.';
        this.loadAll();
      },
      error: (err) => (this.error = err.error?.message || 'Failed to delete item'),
    });
  }

  addToCart(item: MenuItem): void {
    const existing = this.cart.find((c) => c.item._id === item._id);
    if (existing) existing.quantity += 1;
    else this.cart.push({ item, quantity: 1 });
  }

  changeQty(index: number, delta: number): void {
    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) this.cart.splice(index, 1);
  }

  placeOrder(): void {
    if (!this.canManage) return;
    if (!this.cart.length) {
      this.error = 'Add at least one menu item to the order.';
      return;
    }
    if (this.orderType === 'Room Service' && !this.roomNumber.trim()) {
      this.error = 'Room number is required for room service.';
      return;
    }

    this.restaurant
      .createOrder({
        items: this.cart.map((c) => ({
          menuItem: c.item._id!,
          quantity: c.quantity,
        })),
        orderType: this.orderType,
        roomNumber: this.roomNumber.trim() || undefined,
        guestName: this.guestName.trim() || undefined,
        notes: this.notes.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.success = 'Order placed successfully.';
          this.cart = [];
          this.roomNumber = '';
          this.guestName = '';
          this.notes = '';
          this.tab = 'orders';
          this.loadAll();
        },
        error: (err) => (this.error = err.error?.message || 'Failed to place order'),
      });
  }

  setStatus(order: RestaurantOrder, status: OrderStatus): void {
    if (!this.canManage || !order._id) return;
    this.restaurant.updateOrderStatus(order._id, status).subscribe({
      next: (res) => {
        const idx = this.orders.findIndex((o) => o._id === order._id);
        if (idx >= 0) this.orders[idx] = res.data;
        this.success = `Order marked as ${status}.`;
      },
      error: (err) => (this.error = err.error?.message || 'Failed to update status'),
    });
  }

  billOrder(order: RestaurantOrder): void {
    if (!this.canManage || !order._id) return;
    this.restaurant.generateBill(order._id).subscribe({
      next: (res) => {
        const idx = this.orders.findIndex((o) => o._id === order._id);
        if (idx >= 0) this.orders[idx] = res.data;
        this.success = `Bill & receipt generated — LKR ${res.data.totalAmount.toLocaleString()}`;
        this.openReceipt(res.data);
        this.loadSales();
      },
      error: (err) => (this.error = err.error?.message || 'Failed to generate bill'),
    });
  }

  openReceipt(order: RestaurantOrder): void {
    this.receiptOrder = order;
    this.showReceipt = true;
  }

  closeReceipt(): void {
    this.showReceipt = false;
    this.receiptOrder = null;
  }

  printReceipt(): void {
    window.print();
  }

  receiptId(order: RestaurantOrder): string {
    const id = order._id || '';
    return id.slice(-8).toUpperCase() || 'N/A';
  }

  ngOnInit(): void {
    this.loadAll();
    this.loadSales();
  }
}
