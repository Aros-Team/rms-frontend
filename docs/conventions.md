# Conventions

> Style rules, naming, and structure. Follow exactly.

---

## 1. File Naming (kebab-case everywhere)

| Element | File Name | Example |
|---------|-----------|---------|
| Component | `feature-name.ts` | `login-form.ts` |
| Service | `feature-name.ts` | `auth.ts` |
| Guard | `feature-name.ts` | `auth.ts` (guard suffix allowed) |
| Model/DTO | `dto-name.ts` | `user-response.ts` |
| Component folder | `feature-name/` | `login-form/` |

**No `*.component.ts`, `*.service.ts`, `*.model.ts` suffixes in file names.**

---

## 2. Class Naming (PascalCase)

```typescript
// Good
export class LoginForm { }
export class Auth { }
export class Areas { }

// Bad
export class LoginFormComponent { }
export class AuthService { }
export class AreasManager { }
```

---

## 3. Component Decorator

```typescript
@Component({
  selector: 'app-login-form',
  templateUrl: './login-form.html',
  styleUrl: './login-form.css',
})
export class LoginForm { }
```

**Always use `templateUrl` + `styleUrl`. No inline `template` or `styles`.**

---

## 4. Template Rules

- Use **PrimeNG components** as first option
- Use **design tokens** for colors, spacing, typography
- **No hardcoded custom CSS values** (colors, sizes, etc.)
- Class names in templates: **English only**
- User-facing text (labels, messages, buttons): **Spanish**

```html
<!-- Good -->
<p-button label="Iniciar sesión" icon="pi pi-sign-in"></p-button>
<span class="text-surface-500">Precio</span>

<!-- Bad -->
<button class="my-custom-red-button">Click</button>
```

---

## 5. Style Rules

- **Only design tokens** (`--primary-color`, `--surface-500`, etc.)
- **No hardcoded custom styles** outside design system
- **PrimeNG component styling** via built-in classes and tokens
- If custom styles needed: use CSS custom properties referencing tokens

---

## 6. Service Naming

One file per domain, class name matches file name:

```
core/services/
├── auth.ts           class Auth
├── order.ts          class Order
├── product.ts        class Product
```

---

## 7. Variable Naming (camelCase)

```typescript
// Good
const userData = this.auth.getData();
const isLoading = signal(false);

// Bad
const UserData = this.auth.getData();
const IsLoading = signal(false);
```

---

## 8. Signal Usage

```typescript
// Local state
const count = signal(0);

// Computed
const doubled = computed(() => count() * 2);

// In template
@if (doubled() > 0) {
  <span>{{ doubled() }}</span>
}
```

---

## 9. Imports

- Use **path aliases** from `tsconfig.json` (`@core/`, `@shared/`, `@features/`)
- Avoid relative imports crossing module boundaries
- Group imports: Angular → PrimeNG → custom → alphabetical

---

## 10. User-Facing Text

- **Spanish** for all user-visible strings (labels, buttons, messages, toasts)
- **English** for class names, variables, properties, file names, comments

```typescript
this.messageService.add({
  severity: 'error',
  summary: 'Error de autenticación',
  detail: 'Credenciales incorrectas.',
});
```

---

## 11. What is NOT Allowed

- Single `.ts` files combining template + styles inline
- Hardcoded custom CSS colors, fonts, sizes
- `console.log()` for debugging
- TODOs without context
- `print()` statements
- `Component`/`Service`/`Manager` suffixes in class names
- Inline styles (`style=""`) except for dynamic token-based values
