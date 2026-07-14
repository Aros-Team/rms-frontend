import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SpecialSelectionRequest } from '@app/shared/models/dto/special-selections/special-selection-request';
import { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import { ScheduleEntryRequest } from '@app/shared/models/dto/special-selections/schedule-entry';
import { SpecialSelectionHistoryPage } from '@app/shared/models/dto/special-selections/special-selection-history';
import { SpecialSelectionHistoryEntry } from '@app/shared/models/dto/special-selections/special-selection-history';
import { SpecialSelectionHistoryRangeResponse } from '@app/shared/models/dto/special-selections/special-selection-history';
import { SuggestedPriceResponse } from '@app/shared/models/dto/special-selections/special-selection-suggested-price';

@Injectable({
  providedIn: 'root'
})
export class SpecialSelections {
  private http = inject(HttpClient);

  create(req: SpecialSelectionRequest): Observable<SpecialSelectionResponse> {
    return this.http.post<SpecialSelectionResponse>('v1/special-selections', req);
  }

  update(id: number, req: SpecialSelectionRequest): Observable<SpecialSelectionResponse> {
    return this.http.put<SpecialSelectionResponse>('v1/special-selections/' + String(id), req);
  }

  patchSchedule(id: number, body: { entries: ScheduleEntryRequest[] }): Observable<SpecialSelectionResponse> {
    return this.http.patch<SpecialSelectionResponse>('v1/special-selections/' + String(id) + '/schedule', body);
  }

  patchPrice(id: number, body: { basePrice: number }): Observable<SpecialSelectionResponse> {
    return this.http.patch<SpecialSelectionResponse>('v1/special-selections/' + String(id) + '/price', body);
  }

  delete(id: number): Observable<object> {
    return this.http.delete('v1/special-selections/' + String(id));
  }

  getById(id: number): Observable<SpecialSelectionResponse> {
    return this.http.get<SpecialSelectionResponse>('v1/special-selections/' + String(id));
  }

  list(): Observable<SpecialSelectionResponse[]> {
    return this.http.get<SpecialSelectionResponse[]>('v1/special-selections');
  }

  availableNow(): Observable<SpecialSelectionResponse[]> {
    return this.http.get<SpecialSelectionResponse[]>('v1/special-selections/available-now');
  }

  getHistory(id: number, page = 0, size = 10): Observable<SpecialSelectionHistoryPage> {
    return this.http.get<SpecialSelectionHistoryPage>('v1/special-selections/' + String(id) + '/history', {
      params: { page: String(page), size: String(size) }
    });
  }

  getHistoryVersion(id: number, version: number): Observable<SpecialSelectionHistoryEntry> {
    return this.http.get<SpecialSelectionHistoryEntry>('v1/special-selections/' + String(id) + '/history/' + String(version));
  }

  getHistoryRange(id: number, from: string, to: string): Observable<SpecialSelectionHistoryRangeResponse> {
    return this.http.get<SpecialSelectionHistoryRangeResponse>('v1/special-selections/' + String(id) + '/history/range', {
      params: { from: from, to: to }
    });
  }

  revertHistory(id: number, version: number): Observable<SpecialSelectionResponse> {
    return this.http.post<SpecialSelectionResponse>('v1/special-selections/' + String(id) + '/history/' + String(version) + '/revert', {});
  }

  suggestPrice(id: number, body: { marginPercent: number }): Observable<SuggestedPriceResponse> {
    return this.http.post<SuggestedPriceResponse>('v1/special-selections/' + String(id) + '/suggest-price', body);
  }
}