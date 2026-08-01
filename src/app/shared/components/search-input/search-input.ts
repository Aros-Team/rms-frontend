import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

@Component({
  selector: 'app-search-input',
  imports: [
    ButtonModule,
    FormsModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './search-input.html',
})
export class SearchInput implements OnInit {
  @Input() placeholder = 'Buscar...';
  @Input() debounceMs = 500;

  @Output() searchChange = new EventEmitter<string>();

  readonly value = signal<string>('');

  private readonly destroyRef = inject(DestroyRef);
  private readonly inputSubject = new Subject<string>();

  ngOnInit(): void {
    this.inputSubject
      .pipe(
        debounceTime(this.debounceMs),
        map((s) => s.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((trimmed) => {
        this.searchChange.emit(trimmed);
      });
  }

  onInput(value: string): void {
    this.value.set(value);
    this.inputSubject.next(value);
  }

  clear(): void {
    if (this.value() === '') {
      return;
    }
    this.value.set('');
    this.inputSubject.next('');
  }
}
