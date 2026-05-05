import { Directive, ElementRef, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { ResourceCache } from '../cache/resource-cache';

@Directive({
  selector: '[appLazyLoad]',
  standalone: true
})
export class LazyLoadDirective implements OnInit, OnDestroy {
  @Input() appLazyLoad!: ResourceCache<unknown>;
  @Input() appLazyLoadRoot: HTMLElement | null = null;
  @Input() appLazyLoadMargin = '200px';
  @Output() appLazyLoadVisible = new EventEmitter<void>();

  private el = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;
  private hasLoaded = false;

  ngOnInit(): void {
    const element = this.el.nativeElement as HTMLElement;

    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !this.hasLoaded) {
          this.hasLoaded = true;
          this.appLazyLoad.loadIfStale();
          this.appLazyLoadVisible.emit();
          this.observer?.disconnect();
        }
      },
      {
        root: this.appLazyLoadRoot,
        rootMargin: this.appLazyLoadMargin,
        threshold: 0
      }
    );

    this.observer.observe(element as Element);

    // Check if element is already visible (above the fold)
    const rect = element.getBoundingClientRect();
    const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
    if (isVisible && !this.hasLoaded) {
      this.hasLoaded = true;
      this.appLazyLoad.loadIfStale();
      this.appLazyLoadVisible.emit();
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
