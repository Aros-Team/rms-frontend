# Estrategia de Carga Perezosa y Caché - RMS Frontend

## Problema Actual

Los componentes del módulo `manage` cargan **5-6 llamadas API simultáneas** en `ngOnInit`, incluso cuando:
- El usuario solo quiere ver la lista básica
- Los datos no son visibles en pantalla
- Las consultas se repiten al navegar entre rutas

## Solución Propuesta: Arquitectura de Carga Inteligente

### 1. Niveles de Carga de Datos

```
Level 1: Critical (carga inmediata)
  └── Lista básica (productos, categorías, etc.)
  └── 1-2 llamadas API máximo

Level 2: Contextual (carga bajo demanda)
  └── Datos de formularios (áreas, categorías, opciones)
  └── Se carga solo al abrir modal de creación/edición

Level 3: Referencia (carga con caché)
  └── Catálogos estáticos (unidades, tipos, etc.)
  └── Cache por sesión con TTL

Level 4: Tiempo real (WebSocket)
  └── Inventario, pedidos activos
  └── Conexión persistente, no polling
```

### 2. Patrón de Servicio con Caché

```typescript
// services/base/cached-service.ts
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export abstract class CachedService<T> {
  private cache = new Map<string, CacheEntry<T>>();
  protected defaultTTL = 5 * 60 * 1000; // 5 minutos

  protected getCachedOrFetch(
    key: string,
    fetchFn: () => Observable<T>,
    ttl = this.defaultTTL
  ): Observable<T> {
    const cached = this.cache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      // Stale-while-revalidate: devolver caché y refrescar en background
      if ((Date.now() - cached.timestamp) > ttl * 0.8) {
        fetchFn().subscribe(data => this.setCache(key, data, ttl));
      }
      return of(cached.data);
    }

    return fetchFn().pipe(
      tap(data => this.setCache(key, data, ttl))
    );
  }

  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}
```

### 3. Intersection Observer para Lazy Visual

```typescript
// directives/lazy-load.directive.ts
@Directive({
  selector: '[appLazyLoad]',
  standalone: true
})
export class LazyLoadDirective {
  @Output() appLazyLoad = new EventEmitter<void>();
  
  constructor(private el: ElementRef) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          this.appLazyLoad.emit();
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );
    
    observer.observe(this.el.nativeElement);
  }
}
```

### 4. Implementación en Componentes

#### Ejemplo: Products Optimizado

```typescript
@Component({
  selector: 'app-products',
  template: `
    <div appLazyLoad (appLazyLoad)="onVisible()">
      @if (isVisible()) {
        <p-table [value]="products()" ... />
      } @else {
        <p-skeleton height="400px" />
      }
    </div>
    
    <!-- Modal carga datos bajo demanda -->
    @if (modalIsOpen()) {
      <app-product-form
        [areas]="referenceData().areas"
        [categories]="referenceData().categories"
      />
    }
  `
})
export class Products {
  // Level 1: Carga inmediata (solo lista)
  products = signal<Product[]>([]);
  isVisible = signal(false);
  
  // Level 2: Carga bajo demanda (solo al abrir modal)
  referenceData = signal({
    areas: [],
    categories: [],
    optionCategories: [],
    variants: [],
    productOptions: []
  });
  
  modalIsOpen = signal(false);

  onVisible(): void {
    this.isVisible.set(true);
    this.loadProducts(); // Solo 1 llamada
  }

  openModal(): void {
    this.modalIsOpen.set(true);
    this.loadReferenceData(); // 5 llamadas solo cuando se necesitan
  }
}
```

### 5. Estructura de Servicios Optimizada

```typescript
// services/products/product.ts
@Injectable({ providedIn: 'root' })
export class Product extends CachedService<ProductResponse[]> {
  
  // Lista principal - siempre fresca
  getProducts(): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>('/api/products');
  }
  
  // Datos de referencia - cacheados 5 min
  getReferenceData(): Observable<ReferenceData> {
    return this.getCachedOrFetch(
      'reference-data',
      () => forkJoin({
        areas: this.areaService.getAreas(),
        categories: this.categoryService.getCategories(),
        optionCategories: this.optionCategoryService.getOptionCategories(),
        variants: this.supplyService.getSupplyVariants(),
        productOptions: this.getOptions()
      }),
      5 * 60 * 1000 // 5 min TTL
    );
  }
}
```

### 6. Cache Invalidation Strategy

```typescript
// Estrategias de invalidación:

// 1. Por tiempo (TTL)
// 2. Por acción de usuario
afterCreate() {
  this.productService.invalidateCache('products-list');
}

// 3. Por evento WebSocket
ws.on('inventory:updated', () => {
  this.inventoryService.invalidateCache();
});

// 4. Por cambio de contexto
router.events.pipe(
  filter(e => e instanceof NavigationEnd && !e.url.includes('/admin/manage'))
).subscribe(() => {
  // Limpiar caché de manage al salir del módulo
  referenceDataService.clearCache();
});
```

## Beneficios

| Aspecto | Antes | Después |
|---------|-------|---------|
| Llamadas iniciales | 5-6 | 1 |
| Tiempo de carga | 3-5 seg | <1 seg |
| Datos redundantes | Sí | No (caché) |
| Carga bajo demanda | No | Sí |

## Implementación Paso a Paso

1. **Fase 1**: Implementar `CachedService` base
2. **Fase 2**: Migrar products.ts (ejemplo piloto)
3. **Fase 3**: Agregar Intersection Observer
4. **Fase 4**: Migrar inventory, categories, etc.
5. **Fase 5**: Implementar invalidación inteligente

## Notas

- Los datos críticos (lista de productos) siempre se cargan frescos
- Los datos de referencia se cachean por sesión
- WebSocket solo para datos en tiempo real
- Lazy loading visual mejora percepción de velocidad
