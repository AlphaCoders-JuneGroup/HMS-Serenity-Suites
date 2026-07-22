import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

interface StatCard {
  label: string;
  value: string;
  hint: string;
  icon: string;
  accent: string;
}

interface ActionCard {
  title: string;
  description: string;
  icon: string;
}

interface RelatedLink {
  path: string;
  label: string;
  icon: string;
}

interface ModuleConfig {
  stats: StatCard[];
  actions: ActionCard[];
  related: RelatedLink[];
  tips: string[];
}

@Component({
  selector: 'app-module-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './module-page.component.html',
})
export class ModulePageComponent implements OnInit {
  title = '';
  description = '';
  icon = '';
  moduleKey = '';
  stats: StatCard[] = [];
  actions: ActionCard[] = [];
  related: RelatedLink[] = [];
  tips: string[] = [];

  private configs: Record<string, ModuleConfig> = {
    'check-in': {
      stats: [
        { label: "Today's Arrivals", value: '0', hint: 'Expected check-ins', icon: '🛬', accent: 'bg-amber-50 text-amber-600' },
        { label: "Today's Departures", value: '0', hint: 'Expected check-outs', icon: '🛫', accent: 'bg-serenity-50 text-serenity-700' },
        { label: 'Currently In-House', value: '0', hint: 'Checked-in guests', icon: '🏨', accent: 'bg-green-50 text-green-600' },
        { label: 'Pending Assignments', value: '0', hint: 'Rooms not assigned', icon: '🗝️', accent: 'bg-violet-50 text-violet-600' },
      ],
      actions: [
        { title: 'Process Check-in', description: 'Verify guest ID and assign a ready room', icon: '✅' },
        { title: 'Process Check-out', description: 'Settle folio and release the room', icon: '🚪' },
        { title: 'Early / Late Requests', description: 'Approve early arrival or late departure', icon: '⏰' },
        { title: 'Room Change', description: 'Move a guest to another room', icon: '🔄' },
      ],
      related: [
        { path: '/bookings', label: 'Bookings', icon: '📅' },
        { path: '/rooms', label: 'Rooms', icon: '🛏️' },
        { path: '/billing', label: 'Billing', icon: '💳' },
        { path: '/guests', label: 'Guests', icon: '👥' },
      ],
      tips: [
        'Confirm booking status before assigning a room',
        'Check housekeeping readiness before check-in',
        'Collect outstanding payments at check-out',
      ],
    },
    billing: {
      stats: [
        { label: 'Open Folios', value: '0', hint: 'Unsettled guest bills', icon: '🧾', accent: 'bg-emerald-50 text-emerald-600' },
        { label: 'Today’s Payments', value: 'LKR 0', hint: 'Collected today', icon: '💰', accent: 'bg-green-50 text-green-600' },
        { label: 'Outstanding', value: 'LKR 0', hint: 'Pending balances', icon: '⚠️', accent: 'bg-amber-50 text-amber-600' },
        { label: 'Refunds', value: '0', hint: 'Processed refunds', icon: '↩️', accent: 'bg-serenity-50 text-serenity-700' },
      ],
      actions: [
        { title: 'Create Invoice', description: 'Generate a guest folio or bill', icon: '🧾' },
        { title: 'Record Payment', description: 'Cash, card, or online settlement', icon: '💳' },
        { title: 'Partial Payment', description: 'Accept deposit or advance payment', icon: '💵' },
        { title: 'Issue Refund', description: 'Refund cancelled or overpaid bills', icon: '↩️' },
      ],
      related: [
        { path: '/bookings', label: 'Bookings', icon: '📅' },
        { path: '/check-in', label: 'Check-in', icon: '🔑' },
        { path: '/restaurant', label: 'Restaurant', icon: '🍽️' },
        { path: '/reports', label: 'Reports', icon: '📈' },
      ],
      tips: [
        'Link restaurant and room charges to the same folio',
        'Mark payments as Paid, Partial, or Pending',
        'Review outstanding balances before check-out',
      ],
    },
    restaurant: {
      stats: [
        { label: 'Open Orders', value: '0', hint: 'In kitchen / serving', icon: '🍽️', accent: 'bg-orange-50 text-orange-600' },
        { label: 'Today’s Covers', value: '0', hint: 'Guests served today', icon: '👥', accent: 'bg-amber-50 text-amber-600' },
        { label: 'Menu Items', value: '0', hint: 'Active dishes', icon: '📋', accent: 'bg-serenity-50 text-serenity-700' },
        { label: 'Room Charges', value: 'LKR 0', hint: 'Posted to folios', icon: '🏨', accent: 'bg-emerald-50 text-emerald-600' },
      ],
      actions: [
        { title: 'New Order', description: 'Take dine-in, room service, or takeaway', icon: '📝' },
        { title: 'Update Menu', description: 'Add specials and mark items unavailable', icon: '📋' },
        { title: 'Post to Room', description: 'Charge order to guest folio', icon: '🏨' },
        { title: 'Kitchen Queue', description: 'Track preparation and serving status', icon: '👨‍🍳' },
      ],
      related: [
        { path: '/billing', label: 'Billing', icon: '💳' },
        { path: '/guests', label: 'Guests', icon: '👥' },
        { path: '/rooms', label: 'Rooms', icon: '🛏️' },
        { path: '/reports', label: 'Reports', icon: '📈' },
      ],
      tips: [
        'Confirm room number before posting charges',
        'Keep daily specials updated for front desk',
        'Close open orders before end of shift',
      ],
    },
    housekeeping: {
      stats: [
        { label: 'Dirty Rooms', value: '0', hint: 'Need cleaning', icon: '🧹', accent: 'bg-amber-50 text-amber-600' },
        { label: 'Clean & Ready', value: '0', hint: 'Ready for guests', icon: '✨', accent: 'bg-green-50 text-green-600' },
        { label: 'Maintenance', value: '0', hint: 'Out of service', icon: '🛠️', accent: 'bg-red-50 text-red-600' },
        { label: 'Assigned Tasks', value: '0', hint: 'Staff workload', icon: '📌', accent: 'bg-cyan-50 text-cyan-600' },
      ],
      actions: [
        { title: 'Mark Clean', description: 'Set room ready after inspection', icon: '✨' },
        { title: 'Assign Task', description: 'Give rooms to housekeeping staff', icon: '👷' },
        { title: 'Report Issue', description: 'Flag maintenance or damaged items', icon: '🛠️' },
        { title: 'Priority Clean', description: 'Rush rooms for next arrivals', icon: '⚡' },
      ],
      related: [
        { path: '/rooms', label: 'Rooms', icon: '🛏️' },
        { path: '/check-in', label: 'Check-in', icon: '🔑' },
        { path: '/bookings', label: 'Bookings', icon: '📅' },
        { path: '/reports', label: 'Reports', icon: '📈' },
      ],
      tips: [
        'Prioritize rooms with upcoming check-ins',
        'Keep maintenance rooms blocked in Room Management',
        'Update status as soon as cleaning finishes',
      ],
    },
    events: {
      stats: [
        { label: 'Upcoming Events', value: '0', hint: 'Next 30 days', icon: '🎉', accent: 'bg-pink-50 text-pink-600' },
        { label: 'Venues Booked', value: '0', hint: 'Halls / meeting rooms', icon: '🏛️', accent: 'bg-violet-50 text-violet-600' },
        { label: 'Guests Invited', value: '0', hint: 'Across active events', icon: '✉️', accent: 'bg-serenity-50 text-serenity-700' },
        { label: 'Event Revenue', value: 'LKR 0', hint: 'Confirmed packages', icon: '💎', accent: 'bg-emerald-50 text-emerald-600' },
      ],
      actions: [
        { title: 'Create Event', description: 'Conference, wedding, or meeting', icon: '➕' },
        { title: 'Book Venue', description: 'Reserve hall and setup requirements', icon: '🏛️' },
        { title: 'Catering Request', description: 'Link restaurant and package menus', icon: '🍽️' },
        { title: 'Guest List', description: 'Manage invites and attendance', icon: '📝' },
      ],
      related: [
        { path: '/restaurant', label: 'Restaurant', icon: '🍽️' },
        { path: '/rooms', label: 'Rooms', icon: '🛏️' },
        { path: '/billing', label: 'Billing', icon: '💳' },
        { path: '/reports', label: 'Reports', icon: '📈' },
      ],
      tips: [
        'Block rooms early for residential event guests',
        'Confirm catering headcount 48 hours before',
        'Track deposits and final event invoices in Billing',
      ],
    },
    reports: {
      stats: [
        { label: 'Occupancy Rate', value: '0%', hint: 'Current occupancy', icon: '📊', accent: 'bg-indigo-50 text-indigo-600' },
        { label: 'ADR', value: 'LKR 0', hint: 'Average daily rate', icon: '💵', accent: 'bg-emerald-50 text-emerald-600' },
        { label: 'RevPAR', value: 'LKR 0', hint: 'Revenue per available room', icon: '📈', accent: 'bg-serenity-50 text-serenity-700' },
        { label: 'Monthly Revenue', value: 'LKR 0', hint: 'This month so far', icon: '🏦', accent: 'bg-violet-50 text-violet-600' },
      ],
      actions: [
        { title: 'Occupancy Report', description: 'Daily and monthly room fill rates', icon: '🛏️' },
        { title: 'Revenue Summary', description: 'Rooms, F&B, and event income', icon: '💰' },
        { title: 'Guest Insights', description: 'Nationality, repeat guests, stay length', icon: '👥' },
        { title: 'Export Data', description: 'Download CSV / PDF summaries', icon: '⬇️' },
      ],
      related: [
        { path: '/bookings', label: 'Bookings', icon: '📅' },
        { path: '/billing', label: 'Billing', icon: '💳' },
        { path: '/rooms', label: 'Rooms', icon: '🛏️' },
        { path: '/guests', label: 'Guests', icon: '👥' },
      ],
      tips: [
        'Compare weekday vs weekend occupancy',
        'Track unpaid bookings that affect revenue',
        'Use monthly trends for pricing decisions',
      ],
    },
  };

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const data = this.route.snapshot.data;
    this.title = data['title'] ?? 'Module';
    this.description = data['description'] ?? '';
    this.icon = data['icon'] ?? '📋';
    this.moduleKey = data['moduleKey'] ?? '';

    const config = this.configs[this.moduleKey];
    if (config) {
      this.stats = config.stats;
      this.actions = config.actions;
      this.related = config.related;
      this.tips = config.tips;
    }
  }
}
