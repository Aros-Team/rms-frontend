import { Injectable, inject } from '@angular/core';
import { ResourceCache } from '@app/core/cache/resource-cache';
import { User } from '@app/core/services/users/user';
import { UserResponse } from '@app/shared/models/dto/users/user-response.model';

@Injectable({ providedIn: 'root' })
export class UsersCacheService {
  private readonly userService = inject(User);

  // Users list - TTL corto (2 min) por seguridad
  readonly users = new ResourceCache<UserResponse[]>(
    () => this.userService.getEmployees(),
    { ttlMs: 2 * 60 * 1000, staleWhileRevalidate: true }
  );

  invalidateUsers(): void {
    this.users.invalidate();
  }
}
