import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService, User } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  loading = true;
  error = '';
  successMessage = '';
  searchTerm = '';
  filterRole = '';
  filterStatus = '';
  deleteConfirmId: string | null = null;

  readonly roles = [
    'Admin',
    'Receptionist',
    'Manager',
    'Housekeeping Manager',
    'Restaurant Staff',
    'Event Coordinator',
  ];

  readonly roleColors: Record<string, string> = {
    Admin: 'bg-red-100 text-red-700',
    Receptionist: 'bg-blue-100 text-blue-700',
    Manager: 'bg-purple-100 text-purple-700',
    'Housekeeping Manager': 'bg-yellow-100 text-yellow-700',
    'Restaurant Staff': 'bg-orange-100 text-orange-700',
    'Event Coordinator': 'bg-green-100 text-green-700',
  };

  constructor(public auth: AuthService, private userService: UserService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = '';
    this.userService.getUsers().subscribe({
      next: (res) => {
        this.users = res.data;
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load users.';
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    this.filteredUsers = this.users.filter((u) => {
      const matchSearch =
        !this.searchTerm ||
        u.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchRole = !this.filterRole || u.role === this.filterRole;
      const matchStatus =
        this.filterStatus === ''
          ? true
          : this.filterStatus === 'active'
          ? u.isActive
          : !u.isActive;

      return matchSearch && matchRole && matchStatus;
    });
  }

  confirmDelete(id: string): void {
    this.deleteConfirmId = id;
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
  }

  deleteUser(id: string): void {
    this.userService.deleteUser(id).subscribe({
      next: (res) => {
        this.users = this.users.filter((u) => u._id !== id);
        this.applyFilters();
        this.deleteConfirmId = null;
        this.showSuccess(res.message);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to delete user.';
        this.deleteConfirmId = null;
      },
    });
  }

  toggleStatus(user: User): void {
    this.userService.toggleUserStatus(user._id!).subscribe({
      next: (res) => {
        const idx = this.users.findIndex((u) => u._id === user._id);
        if (idx !== -1) this.users[idx] = res.data;
        this.applyFilters();
        this.showSuccess(`User ${res.data.isActive ? 'activated' : 'deactivated'}.`);
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to update status.';
      },
    });
  }

  getRoleColor(role: string): string {
    return this.roleColors[role] || 'bg-gray-100 text-gray-700';
  }

  private showSuccess(msg: string): void {
    this.successMessage = msg;
    setTimeout(() => (this.successMessage = ''), 3500);
  }
}
