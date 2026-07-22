import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EventService,
  HotelEvent,
  EventHall,
  EventStatus,
  EventType,
} from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule],
  templateUrl: './events.component.html',
  styleUrl: './events.component.scss',
})
export class EventsComponent implements OnInit {
  events: HotelEvent[] = [];
  filteredEvents: HotelEvent[] = [];
  halls: EventHall[] = [];
  loading = true;
  error = '';
  success = '';
  actionLoadingId = '';

  // Filters
  searchQ = '';
  filterStatus = '';
  filterEventType = '';
  filterFrom = '';
  filterTo = '';

  statuses: EventStatus[] = ['Inquiry', 'Confirmed', 'Ongoing', 'Completed', 'Cancelled'];
  eventTypes: EventType[] = [
    'Wedding',
    'Conference',
    'Corporate Meeting',
    'Birthday Party',
    'Seminar',
    'Exhibition',
    'Other',
  ];

  // Create / Edit form
  showForm = false;
  editingEvent: HotelEvent | null = null;
  form: Partial<HotelEvent> = this.emptyForm();
  formServices: { name: string; price: number; quantity: number }[] = [];
  newServiceName = '';
  newServicePrice = 0;
  newServiceQty = 1;
  availableHallsForSlot: EventHall[] = [];
  checkingAvailability = false;

  // Payment modal
  paymentEvent: HotelEvent | null = null;
  paymentAmount = 0;
  paymentMethod = 'Cash';
  paymentNote = '';

  // Cancel modal
  cancelEventTarget: HotelEvent | null = null;
  cancelReason = '';

  // Hall management modal (Admin/Manager)
  showHallManager = false;
  hallForm: Partial<EventHall> = this.emptyHallForm();
  editingHall: EventHall | null = null;

  constructor(
    private eventService: EventService,
    private auth: AuthService
  ) {}

  get canManageEvents(): boolean {
    return this.auth.hasRole('Admin', 'Event Coordinator');
  }

  get canManageHalls(): boolean {
    return this.auth.hasRole('Admin', 'Manager');
  }

  ngOnInit(): void {
    this.loadEvents();
    this.loadHalls();
  }

  emptyForm(): Partial<HotelEvent> {
    return {
      eventTitle: '',
      eventType: 'Other',
      hall: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      organization: '',
      eventDate: '',
      startTime: '09:00',
      endTime: '17:00',
      expectedGuests: 1,
      discountPercent: 0,
      taxPercent: 0,
      specialRequests: '',
    };
  }

  emptyHallForm(): Partial<EventHall> {
    return {
      name: '',
      type: 'Banquet Hall',
      capacity: 50,
      ratePerHour: 5000,
      ratePerDay: 0,
      amenities: [],
      description: '',
      isActive: true,
    };
  }

  loadEvents(): void {
    this.loading = true;
    this.eventService.getAllEvents().subscribe({
      next: (res) => {
        this.events = res.data || [];
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load events.';
        this.loading = false;
      },
    });
  }

  loadHalls(): void {
    this.eventService.getAllHalls().subscribe({
      next: (res) => (this.halls = res.data || []),
      error: () => {},
    });
  }

  applyFilters(): void {
    const q = this.searchQ.trim().toLowerCase();
    this.filteredEvents = this.events.filter((e) => {
      if (this.filterStatus && e.status !== this.filterStatus) return false;
      if (this.filterEventType && e.eventType !== this.filterEventType) return false;
      if (this.filterFrom && new Date(e.eventDate) < new Date(this.filterFrom)) return false;
      if (this.filterTo && new Date(e.eventDate) > new Date(this.filterTo)) return false;
      if (q) {
        const hallName = typeof e.hall === 'object' ? e.hall.name : '';
        const haystack = `${e.eventTitle} ${e.customerName} ${e.customerPhone} ${hallName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  search(): void {
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchQ = '';
    this.filterStatus = '';
    this.filterEventType = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.applyFilters();
  }

  hallName(e: HotelEvent): string {
    return typeof e.hall === 'object' ? e.hall.name : '—';
  }

  balanceOf(e: HotelEvent): number {
    return Math.max(0, (e.totalAmount || 0) - (e.amountPaid || 0));
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  get upcomingCount(): number {
    const now = new Date();
    return this.events.filter((e) => new Date(e.eventDate) >= now && e.status !== 'Cancelled').length;
  }

  get confirmedCount(): number {
    return this.events.filter((e) => e.status === 'Confirmed' || e.status === 'Ongoing').length;
  }

  get totalRevenue(): number {
    return this.events
      .filter((e) => e.status !== 'Cancelled')
      .reduce((s, e) => s + (e.totalAmount || 0), 0);
  }

  get pendingPaymentCount(): number {
    return this.events.filter((e) => e.paymentStatus !== 'Paid' && e.status !== 'Cancelled').length;
  }

  // ── Create / Edit form ────────────────────────────────────────────────────
  openCreateForm(): void {
    this.editingEvent = null;
    this.form = this.emptyForm();
    this.formServices = [];
    this.availableHallsForSlot = [];
    this.showForm = true;
    this.error = '';
  }

  openEditForm(e: HotelEvent): void {
    this.editingEvent = e;
    this.form = {
      ...e,
      hall: typeof e.hall === 'object' ? e.hall._id : e.hall,
      eventDate: e.eventDate ? new Date(e.eventDate).toISOString().slice(0, 10) : '',
    };
    this.formServices = (e.services || []).map((s) => ({ name: s.name, price: s.price, quantity: s.quantity }));
    this.showForm = true;
    this.error = '';
  }

  closeForm(): void {
    this.showForm = false;
    this.editingEvent = null;
  }

  checkAvailability(): void {
    if (!this.form.eventDate || !this.form.startTime || !this.form.endTime) return;
    this.checkingAvailability = true;
    this.eventService
      .checkHallAvailability(this.form.eventDate, this.form.startTime, this.form.endTime)
      .subscribe({
        next: (res) => {
          this.availableHallsForSlot = res.data || [];
          this.checkingAvailability = false;
        },
        error: () => {
          this.checkingAvailability = false;
        },
      });
  }

  addFormService(): void {
    if (!this.newServiceName || this.newServicePrice <= 0) return;
    this.formServices.push({
      name: this.newServiceName,
      price: this.newServicePrice,
      quantity: this.newServiceQty || 1,
    });
    this.newServiceName = '';
    this.newServicePrice = 0;
    this.newServiceQty = 1;
  }

  removeFormService(index: number): void {
    this.formServices.splice(index, 1);
  }

  get formServicesTotal(): number {
    return this.formServices.reduce((s, i) => s + i.price * i.quantity, 0);
  }

  saveEvent(): void {
    if (!this.form.eventTitle || !this.form.hall || !this.form.customerName || !this.form.customerPhone) {
      this.error = 'Please fill in event title, hall, customer name, and phone.';
      return;
    }
    const payload: Partial<HotelEvent> = { ...this.form, services: this.formServices };

    const request$ = this.editingEvent?._id
      ? this.eventService.updateEvent(this.editingEvent._id, payload)
      : this.eventService.createEvent(payload);

    request$.subscribe({
      next: (res) => {
        this.success = this.editingEvent ? 'Event updated successfully.' : 'Event created successfully.';
        this.showForm = false;
        this.loadEvents();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to save event.';
      },
    });
  }

  // ── Status actions ────────────────────────────────────────────────────────
  confirmEvent(e: HotelEvent): void {
    if (!e._id) return;
    this.actionLoadingId = e._id;
    this.eventService.confirmEvent(e._id).subscribe({
      next: () => {
        this.success = 'Event confirmed.';
        this.actionLoadingId = '';
        this.loadEvents();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to confirm event.';
        this.actionLoadingId = '';
      },
    });
  }

  startEvent(e: HotelEvent): void {
    if (!e._id) return;
    this.actionLoadingId = e._id;
    this.eventService.startEvent(e._id).subscribe({
      next: () => {
        this.success = 'Event marked as ongoing.';
        this.actionLoadingId = '';
        this.loadEvents();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to update event.';
        this.actionLoadingId = '';
      },
    });
  }

  completeEvent(e: HotelEvent): void {
    if (!e._id) return;
    this.actionLoadingId = e._id;
    this.eventService.completeEvent(e._id).subscribe({
      next: () => {
        this.success = 'Event completed.';
        this.actionLoadingId = '';
        this.loadEvents();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to complete event.';
        this.actionLoadingId = '';
      },
    });
  }

  openCancelModal(e: HotelEvent): void {
    this.cancelEventTarget = e;
    this.cancelReason = '';
  }

  confirmCancel(): void {
    if (!this.cancelEventTarget?._id) return;
    this.eventService.cancelEvent(this.cancelEventTarget._id, this.cancelReason).subscribe({
      next: () => {
        this.success = 'Event cancelled.';
        this.cancelEventTarget = null;
        this.loadEvents();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to cancel event.';
      },
    });
  }

  deleteEvent(e: HotelEvent): void {
    if (!e._id || !confirm(`Delete event "${e.eventTitle}"? This cannot be undone.`)) return;
    this.eventService.deleteEvent(e._id).subscribe({
      next: () => {
        this.success = 'Event deleted.';
        this.loadEvents();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete event.';
      },
    });
  }

  // ── Payments ───────────────────────────────────────────────────────────────
  openPaymentModal(e: HotelEvent): void {
    this.paymentEvent = e;
    this.paymentAmount = this.balanceOf(e);
    this.paymentMethod = 'Cash';
    this.paymentNote = '';
  }

  submitPayment(): void {
    if (!this.paymentEvent?._id || this.paymentAmount <= 0) return;
    this.eventService
      .addPayment(this.paymentEvent._id, {
        amount: this.paymentAmount,
        method: this.paymentMethod,
        note: this.paymentNote,
      })
      .subscribe({
        next: () => {
          this.success = 'Payment recorded.';
          this.paymentEvent = null;
          this.loadEvents();
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to record payment.';
        },
      });
  }

  // ── Hall management (Admin/Manager) ─────────────────────────────────────────
  openHallManager(): void {
    this.showHallManager = true;
    this.editingHall = null;
    this.hallForm = this.emptyHallForm();
  }

  editHall(h: EventHall): void {
    this.editingHall = h;
    this.hallForm = { ...h };
  }

  saveHall(): void {
    if (!this.hallForm.name || !this.hallForm.capacity || !this.hallForm.ratePerHour) {
      this.error = 'Hall name, capacity, and hourly rate are required.';
      return;
    }
    const request$ = this.editingHall?._id
      ? this.eventService.updateHall(this.editingHall._id, this.hallForm)
      : this.eventService.createHall(this.hallForm);

    request$.subscribe({
      next: () => {
        this.success = this.editingHall ? 'Hall updated.' : 'Hall added.';
        this.editingHall = null;
        this.hallForm = this.emptyHallForm();
        this.loadHalls();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to save hall.';
      },
    });
  }

  deleteHall(h: EventHall): void {
    if (!h._id || !confirm(`Delete hall "${h.name}"?`)) return;
    this.eventService.deleteHall(h._id).subscribe({
      next: () => {
        this.success = 'Hall deleted.';
        this.loadHalls();
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete hall.';
      },
    });
  }
}
