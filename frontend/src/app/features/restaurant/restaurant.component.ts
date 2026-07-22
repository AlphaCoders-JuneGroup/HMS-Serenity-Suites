import { Component, OnDestroy, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BookingService } from '../../core/services/booking.service';
import { Guest, GuestService } from '../../core/services/guest.service';
import {
  DailySales,
  MenuCategory,
  MenuItem,
  OrderStatus,
  OrderType,
  RestaurantOrder,
  RestaurantService,
  RestaurantShift,
  RestaurantTable,
} from '../../core/services/restaurant.service';

type Tab = 'orders' | 'kitchen' | 'menu' | 'new-order' | 'tables' | 'sales' | 'shift';

@Component({
  selector: 'app-restaurant',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, TitleCasePipe, FormsModule, RouterLink],
  templateUrl: './restaurant.component.html',
  styleUrl: './restaurant.component.scss',
})
export class RestaurantComponent implements OnInit, OnDestroy {
  tab: Tab = 'orders';
  menu: MenuItem[] = [];
  filteredMenu: MenuItem[] = [];
  orders: RestaurantOrder[] = [];
  kitchenOrders: RestaurantOrder[] = [];
  tables: RestaurantTable[] = [];
  guests: Guest[] = [];
  rooms: { _id?: string; roomNumber: string }[] = [];
  sales: DailySales | null = null;
  rangeSales: any = null;
  salesDate = new Date().toISOString().slice(0, 10);
  rangeFrom = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  rangeTo = new Date().toISOString().slice(0, 10);
  shift: RestaurantShift | null = null;
  shifts: RestaurantShift[] = [];

  loading = true;
  error = '';
  success = '';
  menuSearch = '';
  menuCategoryFilter = '';
  private pollTimer: any;

  showMenuForm = false;
  editingMenuId: string | null = null;
  menuForm: any = {
    name: '',
    description: '',
    category: 'Food' as MenuCategory,
    price: 0,
    happyHourPrice: null,
    happyHourStart: 17,
    happyHourEnd: 19,
    available: true,
    preparationTime: 15,
    stock: null,
    allergens: '',
    isCombo: false,
    image: '',
  };

  cart: { item: MenuItem; quantity: number; note: string }[] = [];
  orderType: OrderType = 'Dine-In';
  roomNumber = '';
  guestId = '';
  guestName = '';
  tableId = '';
  waiter = '';
  notes = '';
  discountPercent = 0;
  taxRate = 0.1;
  serviceChargeRate = 0.05;
  orderFilter = '';
  editingOrderId: string | null = null;

  receiptOrder: RestaurantOrder | null = null;
  showReceipt = false;
  paymentOrder: RestaurantOrder | null = null;
  paymentAmount = 0;
  paymentMethod = 'Cash';
  cancelOrderId = '';
  cancelReason = '';

  openingCash = 0;
  closingCash = 0;
  shiftNotes = '';
  newTable = { tableNumber: '', capacity: 4, location: 'Main Hall' };

  categories: MenuCategory[] = ['Food', 'Beverage', 'Dessert', 'Special', 'Combo'];
  orderTypes: OrderType[] = ['Dine-In', 'Room Service', 'Takeaway'];
  statuses: OrderStatus[] = ['Pending', 'Preparing', 'Ready', 'Served', 'Billed', 'Cancelled'];

  constructor(
    private restaurant: RestaurantService,
    private auth: AuthService,
    private guestService: GuestService,
    private bookingService: BookingService
  ) {}

  get canManage(): boolean {
    return this.auth.hasRole('Admin', 'Restaurant Staff');
  }

  get availableMenu(): MenuItem[] {
    return this.filteredMenu.filter((m) => m.available && (m.stock == null || m.stock > 0));
  }

  get cartSubtotal(): number {
    return this.cart.reduce(
      (sum, line) => sum + (line.item.effectivePrice ?? line.item.price) * line.quantity,
      0
    );
  }

  get cartTax(): number {
    return Math.round(this.cartSubtotal * this.taxRate * 100) / 100;
  }

  get cartService(): number {
    return Math.round(this.cartSubtotal * this.serviceChargeRate * 100) / 100;
  }

  get cartDiscount(): number {
    return Math.round(
      ((this.cartSubtotal + this.cartTax + this.cartService) * this.discountPercent) / 100
    );
  }

  get cartTotal(): number {
    return Math.max(0, this.cartSubtotal + this.cartTax + this.cartService - this.cartDiscount);
  }

  get selectedGuestAllergies(): string {
    const g = this.guests.find((x) => x._id === this.guestId);
    return g?.preferences?.dietaryNeeds || g?.preferences?.specialNeeds || '';
  }

  get pendingOrders(): number {
    return this.orders.filter((o) => ['Pending', 'Preparing', 'Ready'].includes(o.status)).length;
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
    if (tab === 'sales') {
      this.loadSales();
      this.loadRangeSales();
    }
    if (tab === 'kitchen') this.loadKitchen();
    if (tab === 'tables') this.loadTables();
    if (tab === 'shift') this.loadShift();
    if (tab === 'new-order') this.applyMenuFilter();
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

  tableStatusClass(s: string): string {
    switch (s) {
      case 'Available':
        return 'badge-success';
      case 'Occupied':
        return 'badge-warning';
      case 'Reserved':
        return 'badge-info';
      default:
        return 'badge-neutral';
    }
  }

  priceOf(item: MenuItem): number {
    return item.effectivePrice ?? item.price;
  }

  /** Fallback when API/old server omits image field */
  private readonly defaultMenuImages: Record<string, string> = {
    Cappuccino: '/uploads/menu-images/cappuccino.jpg',
    'Fresh Lime Juice': '/uploads/menu-images/fresh-lime-juice.jpg',
    'Chocolate Brownie': '/uploads/menu-images/chocolate-brownie.jpg',
    'Ceylon Breakfast': '/uploads/menu-images/ceylon-breakfast.jpg',
    'Chicken Fried Rice': '/uploads/menu-images/chicken-fried-rice.jpg',
    'Club Sandwich': '/uploads/menu-images/club-sandwich.jpg',
    'Chef Special Curry': '/uploads/menu-images/chef-special-curry.jpg',
  };

  private readonly defaultTableImages: Record<string, string> = {
    T1: '/uploads/table-images/t1-window.jpg',
    T2: '/uploads/table-images/t2-hall.jpg',
    T3: '/uploads/table-images/t3-hall.jpg',
    T4: '/uploads/table-images/t4-patio.jpg',
    T5: '/uploads/table-images/t5-private.jpg',
  };

  imageUrl(item?: MenuItem | null): string | null {
    if (!item) return null;
    const path = item.image || this.defaultMenuImages[item.name] || '';
    return this.restaurant.assetUrl(path);
  }

  tableImageUrl(table?: RestaurantTable | null): string | null {
    if (!table) return null;
    const path = table.image || this.defaultTableImages[table.tableNumber] || '';
    return this.restaurant.assetUrl(path);
  }

  get menuFormPreviewUrl(): string | null {
    return this.restaurant.assetUrl(this.menuForm?.image);
  }

  loadAll(): void {
    this.loading = true;
    this.restaurant.getMenu().subscribe({
      next: (res) => {
        this.menu = res.data ?? [];
        this.applyMenuFilter();
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

  applyMenuFilter(): void {
    let list = [...this.menu];
    if (this.menuCategoryFilter) list = list.filter((m) => m.category === this.menuCategoryFilter);
    const q = this.menuSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q) ||
          (m.allergens || '').toLowerCase().includes(q)
      );
    }
    this.filteredMenu = list;
  }

  loadKitchen(): void {
    this.restaurant.getKitchen().subscribe({
      next: (res) => (this.kitchenOrders = res.data ?? []),
      error: (err) => (this.error = err.error?.message || 'Failed to load kitchen'),
    });
  }

  loadTables(): void {
    this.restaurant.getTables().subscribe({
      next: (res) => (this.tables = res.data ?? []),
      error: (err) => (this.error = err.error?.message || 'Failed to load tables'),
    });
  }

  loadSales(): void {
    this.restaurant.getDailySales(this.salesDate).subscribe({
      next: (res) => (this.sales = res.data),
      error: (err) => (this.error = err.error?.message || 'Failed to load sales'),
    });
  }

  loadRangeSales(): void {
    this.restaurant.getSalesRange(this.rangeFrom, this.rangeTo).subscribe({
      next: (res) => (this.rangeSales = res.data),
      error: (err) => (this.error = err.error?.message || 'Failed to load range sales'),
    });
  }

  loadShift(): void {
    this.restaurant.getCurrentShift().subscribe({
      next: (res) => (this.shift = res.data),
    });
    this.restaurant.getShifts().subscribe({
      next: (res) => (this.shifts = res.data ?? []),
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
        happyHourPrice: item.happyHourPrice,
        happyHourStart: item.happyHourStart ?? 17,
        happyHourEnd: item.happyHourEnd ?? 19,
        available: item.available,
        preparationTime: item.preparationTime || 15,
        stock: item.stock,
        allergens: item.allergens || '',
        isCombo: !!item.isCombo,
        image: item.image || '',
      };
    } else {
      this.editingMenuId = null;
      this.menuForm = {
        name: '',
        description: '',
        category: 'Food',
        price: 0,
        happyHourPrice: null,
        happyHourStart: 17,
        happyHourEnd: 19,
        available: true,
        preparationTime: 15,
        stock: null,
        allergens: '',
        isCombo: false,
        image: '',
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

  onMenuImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.editingMenuId) {
      this.error = 'Save the menu item first, then upload an image.';
      input.value = '';
      return;
    }
    this.restaurant.uploadMenuImage(this.editingMenuId, file).subscribe({
      next: (res) => {
        this.menuForm.image = res.data.image || '';
        this.success = 'Image uploaded.';
        this.loadAll();
        input.value = '';
      },
      error: (err) => {
        this.error = err.error?.message || 'Image upload failed';
        input.value = '';
      },
    });
  }

  addToCart(item: MenuItem): void {
    const existing = this.cart.find((c) => c.item._id === item._id);
    if (existing) existing.quantity += 1;
    else this.cart.push({ item, quantity: 1, note: '' });
  }

  changeQty(index: number, delta: number): void {
    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) this.cart.splice(index, 1);
  }

  onGuestChange(): void {
    const g = this.guests.find((x) => x._id === this.guestId);
    if (g) this.guestName = `${g.firstName} ${g.lastName}`;
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

    const payload = {
      items: this.cart.map((c) => ({
        menuItem: c.item._id!,
        quantity: c.quantity,
        note: c.note || '',
      })),
      orderType: this.orderType,
      roomNumber: this.roomNumber.trim() || undefined,
      guest: this.guestId || undefined,
      guestName: this.guestName.trim() || undefined,
      table: this.tableId || undefined,
      waiter: this.waiter.trim() || undefined,
      notes: this.notes.trim() || undefined,
      discountPercent: this.discountPercent,
      taxRate: this.taxRate,
      serviceChargeRate: this.serviceChargeRate,
    };

    const req$ = this.editingOrderId
      ? this.restaurant.updateOrder(this.editingOrderId, payload)
      : this.restaurant.createOrder(payload);

    req$.subscribe({
      next: () => {
        this.success = this.editingOrderId ? 'Order updated.' : 'Order placed successfully.';
        this.cart = [];
        this.roomNumber = '';
        this.guestId = '';
        this.guestName = '';
        this.tableId = '';
        this.notes = '';
        this.discountPercent = 0;
        this.editingOrderId = null;
        this.tab = 'orders';
        this.loadAll();
        this.loadTables();
      },
      error: (err) => (this.error = err.error?.message || 'Failed to place order'),
    });
  }

  editOrder(order: RestaurantOrder): void {
    if (!this.canManage || ['Billed', 'Cancelled'].includes(order.status)) return;
    this.editingOrderId = order._id || null;
    this.orderType = order.orderType;
    this.roomNumber = order.roomNumber || '';
    this.guestName = order.guestName || '';
    this.guestId = typeof order.guest === 'object' && order.guest?._id ? order.guest._id : '';
    this.tableId = typeof order.table === 'object' && order.table?._id ? order.table._id : '';
    this.waiter = order.waiter || '';
    this.notes = order.notes || '';
    this.discountPercent = order.discountPercent || 0;
    this.cart = order.items.map((line) => {
      const menuItem =
        this.menu.find((m) => m._id === line.menuItem) ||
        ({
          _id: line.menuItem,
          name: line.name,
          price: line.price,
          effectivePrice: line.price,
          category: 'Food',
          available: true,
        } as MenuItem);
      return { item: menuItem, quantity: line.quantity, note: line.note || '' };
    });
    this.tab = 'new-order';
  }

  setStatus(order: RestaurantOrder, status: OrderStatus): void {
    if (!this.canManage || !order._id) return;
    if (status === 'Cancelled') {
      this.cancelOrderId = order._id;
      this.cancelReason = '';
      return;
    }
    this.restaurant.updateOrderStatus(order._id, status).subscribe({
      next: (res) => {
        this.replaceOrder(res.data);
        this.success = `Order marked as ${status}.`;
        if (this.tab === 'kitchen') this.loadKitchen();
      },
      error: (err) => (this.error = err.error?.message || 'Failed to update status'),
    });
  }

  confirmCancel(): void {
    if (!this.cancelOrderId) return;
    this.restaurant
      .updateOrderStatus(this.cancelOrderId, 'Cancelled', this.cancelReason || 'No reason')
      .subscribe({
        next: (res) => {
          this.replaceOrder(res.data);
          this.success = 'Order cancelled.';
          this.cancelOrderId = '';
          this.loadTables();
          this.loadKitchen();
        },
        error: (err) => (this.error = err.error?.message || 'Cancel failed'),
      });
  }

  billOrder(order: RestaurantOrder, chargeToRoom = false): void {
    if (!this.canManage || !order._id) return;
    this.restaurant
      .generateBill(order._id, {
        chargeToRoom: chargeToRoom || order.orderType === 'Room Service',
        discountPercent: order.discountPercent,
      })
      .subscribe({
        next: (res) => {
          this.replaceOrder(res.data);
          this.success = `Bill generated — LKR ${res.data.totalAmount.toLocaleString()}`;
          this.openReceipt(res.data);
          this.loadSales();
          this.loadTables();
        },
        error: (err) => (this.error = err.error?.message || 'Failed to generate bill'),
      });
  }

  openPayment(order: RestaurantOrder): void {
    this.paymentOrder = order;
    this.paymentAmount = Math.max(0, (order.totalAmount || 0) - (order.amountPaid || 0));
    this.paymentMethod = 'Cash';
  }

  submitPayment(): void {
    if (!this.paymentOrder?._id || this.paymentAmount <= 0) return;
    this.restaurant
      .addPayment(this.paymentOrder._id, {
        amount: this.paymentAmount,
        method: this.paymentMethod,
      })
      .subscribe({
        next: (res) => {
          this.replaceOrder(res.data);
          this.success = 'Payment recorded.';
          this.paymentOrder = null;
        },
        error: (err) => (this.error = err.error?.message || 'Payment failed'),
      });
  }

  notifyReceipt(order: RestaurantOrder): void {
    if (!order._id) return;
    this.restaurant.notifyReceipt(order._id).subscribe({
      next: (res) => (this.success = res.message),
      error: (err) => (this.error = err.error?.message || 'Notify failed'),
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
    return (order._id || '').slice(-8).toUpperCase() || 'N/A';
  }

  createTable(): void {
    if (!this.newTable.tableNumber.trim()) return;
    this.restaurant.createTable(this.newTable).subscribe({
      next: () => {
        this.success = 'Table created.';
        this.newTable = { tableNumber: '', capacity: 4, location: 'Main Hall' };
        this.loadTables();
      },
      error: (err) => (this.error = err.error?.message || 'Failed to create table'),
    });
  }

  setTableStatus(table: RestaurantTable, status: RestaurantTable['status']): void {
    if (!table._id) return;
    this.restaurant.updateTable(table._id, { status }).subscribe({
      next: () => this.loadTables(),
      error: (err) => (this.error = err.error?.message || 'Update failed'),
    });
  }

  openShift(): void {
    this.restaurant.openShift(this.openingCash).subscribe({
      next: (res) => {
        this.shift = res.data;
        this.success = 'Shift opened.';
        this.loadShift();
      },
      error: (err) => (this.error = err.error?.message || 'Failed to open shift'),
    });
  }

  closeShift(): void {
    this.restaurant.closeShift({ closingCash: this.closingCash, notes: this.shiftNotes }).subscribe({
      next: (res) => {
        this.shift = null;
        this.success = `Shift closed. Revenue LKR ${(res.data.revenue || 0).toLocaleString()}`;
        this.loadShift();
      },
      error: (err) => (this.error = err.error?.message || 'Failed to close shift'),
    });
  }

  private replaceOrder(updated: RestaurantOrder): void {
    this.orders = this.orders.map((o) => (o._id === updated._id ? updated : o));
    this.kitchenOrders = this.kitchenOrders
      .map((o) => (o._id === updated._id ? updated : o))
      .filter((o) => ['Pending', 'Preparing', 'Ready'].includes(o.status));
  }

  ngOnInit(): void {
    this.loadAll();
    this.loadSales();
    this.loadTables();
    this.loadShift();
    this.guestService.getGuests({ limit: 100 }).subscribe({
      next: (res: any) => (this.guests = res.data ?? []),
    });
    this.bookingService.getRooms().subscribe({
      next: (res) => (this.rooms = res.data ?? []),
    });
    this.pollTimer = setInterval(() => {
      if (this.tab === 'kitchen') this.loadKitchen();
      if (this.tab === 'orders') {
        this.restaurant.getOrders().subscribe({
          next: (res) => (this.orders = res.data ?? []),
        });
      }
    }, 12000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
}
