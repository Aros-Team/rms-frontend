import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Header } from '../components/header/header';

@Component({
  selector: 'app-worker-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Header, CommonModule],
  templateUrl: './worker-layout.html',
  styles: ``
})
export class WorkerLayout {
  @Input() workerType?: string;
  @Input() role?: string;
}
