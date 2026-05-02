import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DayMenuResponse, DayMenuHistoryPage } from '@app/shared/models/dto/daymenu/daymenu-response';

@Injectable({
  providedIn: 'root'
})
export class DayMenuService {
  private http = inject(HttpClient);

  getCurrentDayMenu(): Observable<DayMenuResponse | null> {
    return this.http.get<DayMenuResponse | null>('v1/day-menu/current');
  }

  updateDayMenu(productId: number): Observable<DayMenuResponse> {
    return this.http.put<DayMenuResponse>('v1/day-menu', { productId });
  }

  getHistory(page = 0, size = 10): Observable<DayMenuHistoryPage> {
    return this.http.get<DayMenuHistoryPage>('v1/day-menu/history', {
      params: { page, size }
    });
  }
}