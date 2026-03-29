# AGENTS.md - Developer Guidelines for AI Agents

This file contains guidelines and conventions for AI agents working on this codebase.

## 1. Build, Lint, and Test Commands

This project uses [Taskfile](https://taskfile.dev/) for running common commands.

### Build Commands
```bash
# Start development server
task run

# Development build (with color generation)
npm run build:dev

# Production build
npm run build

# Watch mode for development
npm run watch
```

### Linting
```bash
# Run lint with auto-fix
task format

# Or via Angular CLI
npm run lint
```

### Testing
```bash
# Run all tests
task test

# Run tests in watch mode (interactive)
ng test --watch

# Run tests with coverage
ng test --code-coverage
```

Note: This project uses Karma + Jasmine for testing. Test files follow the pattern `*.spec.ts`.

## 2. Project Structure

```
src/
├── app/
│   ├── core/              # Core functionality
│   │   ├── guards/        # Route guards (AuthGuard, RoleGuard)
│   │   ├── interceptors/  # HTTP interceptors
│   │   └── services/     # Singleton services
│   ├── features/          # Feature modules (admin, auth, kitchen, waiter)
│   ├── shared/
│   │   ├── components/   # Reusable components
│   │   └── models/       # TypeScript interfaces/types
│   │       ├── dto/       # Data Transfer Objects
│   │       └── domain/    # Domain models
│   └── areas/            # Area layouts (admin, worker, login)
├── environments/         # Environment configuration
└── styles.css            # Global styles
```

## 3. TypeScript Configuration

The project uses strict TypeScript mode with the following key settings:
- `strict: true`
- `noImplicitOverride: true`
- `noPropertyAccessFromIndexSignature: true`
- `noImplicitReturns: true`
- `noFallthroughCasesInSwitch: true`

Always use explicit types. Avoid `any`.

## 4. Path Aliases

Use path aliases for imports instead of relative paths:

```typescript
// Good
import { ProductService } from '@app/core/services/products/product-service';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';

// Avoid
import { ProductService } from '../../../core/services/products/product-service';
```

Available aliases:
- `@app/*` - src/app/*
- `@core/*` - src/app/core/*
- `@features/*` - src/app/features/*
- `@shared/*` - src/app/shared/*
- `@models/*` - src/app/shared/models/*
- `@services/*` - src/app/core/services/*
- `@components/*` - src/app/shared/components/*
- `@areas/*` - src/app/areas/*
- `@environments/*` - src/environments/*

## 5. Angular Conventions

### Standalone Components
This project uses Angular standalone components. Do NOT use NgModules.

```typescript
// Good - Standalone component
@Component({
  selector: 'app-products',
  standalone: true,
  imports: [RouterModule, TableModule, ButtonModule],
  templateUrl: './products.html',
})
export class Products { }

// Avoid - NgModule-based component
```

### Dependency Injection
Use `inject()` function instead of constructor injection when possible:

```typescript
// Preferred
export class Products implements OnInit {
  private productService = inject(ProductService);
}

// Also acceptable for services with dependencies
constructor(private productService: ProductService) { }
```

### Signals
Use signals for reactive state management where appropriate:

```typescript
export class MyComponent {
  products = signal<ProductResponse[]>([]);
  
  updateProducts(): void {
    this.productService.getProducts().subscribe(res => {
      this.products.set(res);
    });
  }
}
```

## 6. Naming Conventions

### Files
- Components: `*.component.ts` or feature name (e.g., `products.ts`)
- Services: `*-service.ts` (e.g., `product-service.ts`)
- Models: `*.model.ts` or `*.interface.ts`
- DTOs: `*-request.model.ts`, `*-response.model.ts`
- Guards: `*-guard.ts` (e.g., `auth-guard.ts`)
- Interceptors: `*-interceptor.ts`

### Classes/Interfaces
- PascalCase for classes and interfaces
- Interfaces should NOT be prefixed with "I"
```typescript
// Good
interface ProductResponse { }

// Avoid
interface IProductResponse { }
```

### Variables/Functions
- camelCase for variables and functions
- Private properties should be prefixed with underscore OR use private keyword
```typescript
// Preferred
private productService = inject(ProductService);
private _products: ProductResponse[];

// Also seen
private productService: ProductService;
```

## 7. Import Organization

Organize imports in the following order:

1. Angular core imports
2. Angular router/forms
3. Path alias imports (@app/*, @core/*, @shared/*)
4. Third-party libraries (primeng/*)
5. Relative imports

```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ProductService } from '@app/core/services/products/product-service';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

import { MyComponent } from './my-component';
```

## 8. PrimeNG Usage

### Component Imports
Import PrimeNG modules directly in the component's imports array:

```typescript
@Component({
  standalone: true,
  imports: [ButtonModule, TableModule, DialogModule],
  // ...
})
export class MyComponent { }
```

### Icons
Use PrimeIcons for icons. Do NOT import icon components directly - use templates:

```html
<button pButton label="Save" icon="pi pi-check"></button>
<span class="pi pi-user"></span>
```

## 9. Error Handling

- Use RxJS `catchError` for observable error handling
- Use `LoggingService` for logging instead of `console.log`
- Handle errors gracefully in components

```typescript
// Good
this.productService.getProducts().pipe(
  catchError(() => of([]))
).subscribe(products => this.products = products);

// Use LoggingService
import { LoggingService } from '@app/core/services/logging/logging-service';
private logger = inject(LoggingService);
this.logger.info('Loading products');
this.logger.error('Failed to load products', error);
```

## 10. Forms

- Use ReactiveFormsModule for all forms
- Use FormBuilder with dependency injection
- Include proper validation

```typescript
export class MyComponent {
  private fb = inject(FormBuilder);
  
  form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    age: [null, [Validators.min(0), Validators.max(150)]]
  });
  
  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control?.invalid && control?.touched && control?.dirty;
  }
}
```

## 11. HTTP Services

- Use proper typing for HTTP responses
- Use path aliases for API endpoints
- Use descriptive method names

```typescript
@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  
  public getProducts(): Observable<ProductResponse[]> {
    return this.http.get<ProductResponse[]>('v1/products');
  }
  
  public createProduct(data: ProductCreateRequest): Observable<object> {
    return this.http.post('v1/products', data);
  }
}
```

## 12. Routes and Guards

- Use functional guards (not class-based)
- Implement lazy loading for routes
- Use redirect commands for navigation

```typescript
// Routes example
export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { 
    path: 'admin', 
    component: AdminArea,
    canActivate: [AuthGuard, RoleGuard],
    children: [/* ... */]
  }
];
```

## 13. Prettier Configuration

The project uses Prettier with these settings:
- Print width: 100
- Single quotes: true
- Parser: angular (for HTML templates)

Run `npm run lint` to auto-format.

## 14. Git Conventions

- Use conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `style:`
- Create tags for releases following SemVer: `v0.1.0`, `v0.2.0`, etc.
- Update CHANGELOG.md for each release

## 15. PrimeNG & Design Guidelines

### Documentation References
- **PrimeNG:** Before implementing or modifying any interface component, consult https://primeng.org/llms/llms-full.txt
- **Angular:** Read https://angular.dev/assets/context/llms-full.txt for best practices before making modifications

### Component Library
- **Always prefer PrimeNG** for UI components and icons
- Use PrimeIcons for all icons in the interface
- Avoid custom CSS for common UI patterns that PrimeNG provides

### Styling Rules
- **Never hardcode colors or fonts** - always use PrimeNG design tokens
- Use semantic tokens from PrimeNG theme instead of hardcoded values
- Example:
  ```typescript
  // Good - use PrimeNG tokens
  color: var(--p-primary-500);
  font-family: var(--font-family);
  
  // Avoid
  color: #F9BB0B;
  font-family: 'Roboto', sans-serif;
  ```

## 16. Angular Best Practices (Required)

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

### TypeScript Best Practices
- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

### Angular Best Practices
- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

### Accessibility Requirements
- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components
- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

### State Management
- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

### Templates
- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

### Services
- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

## 17. Docker Best Practices

This project uses Docker for containerization. The Dockerfile is located in `build/Dockerfile`.

### Documentation References
- **Docker:** Before creating or modifying Docker configurations, consult https://docs.docker.com/llms.txt
- Focus on: Building images, Writing Dockerfiles, Multi-stage builds, Image layers, Build cache

### Building Images

```bash
# Build Docker image (using version from package.json)
task build

# Or manually
docker build -t spalaxdev/rms-frontend:0.1.0 build/
```

### Dockerfile Best Practices

- **Use multi-stage builds** for optimized image size
- **Leverage build cache** by ordering instructions from least to most frequently changing
- **Use specific base image versions** (e.g., `nginx:stable-alpine` not `nginx:latest`)
- **Minimize layers** by combining related instructions
- **Use .dockerignore** to exclude unnecessary files

Example structure:
```dockerfile
# Build stage (if needed for Angular)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Image Tagging

- Use semantic versioning: `spalaxdev/rms-frontend:0.2.0`
- Tag latest for current stable: `spalaxdev/rms-frontend:latest`
- Always tag before pushing to registry

### Build Process

The project's build process (via `task build`):
1. Run tests (`npm test`)
2. Check code format (`npm run lint:check`)
3. Build Angular app (`npm run build`)
4. Build Docker image (`docker build -t spalaxdev/rms-frontend:VERSION build/`)
