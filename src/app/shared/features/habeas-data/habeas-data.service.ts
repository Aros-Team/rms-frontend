import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HabeasDataService {
  showDialog = new Subject<void>();
  accepted = new Subject<void>();
  rejected = new Subject<void>();
}
