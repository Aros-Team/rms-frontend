# Testing Policy

> How to write tests that actually catch bugs.
> A test's value = its ability to **fail when the code is wrong**.

---

## 0. Core principle: the mutation mindset

Before writing a test, ask: *"If this component/service/pipe were broken — deleted,
returned the wrong value, or crashed on input X — would this test fail?"*

If the test would still pass, it has no value. Rewrite it or delete it.

---

## 1. File header (mandatory)

Every `.spec.ts` file MUST begin with a comment block explaining:

1. **What feature** is being tested
2. **What the feature should do** (contract)
3. **How the test verifies it** (approach)

```typescript
/**
 * Tests for the Money pipe.
 *
 * Feature: Formats Money DTOs into locale-aware COP/USD strings.
 * Contract:
 *  - null/undefined → em dash ("—")
 *  - COP → "$1.234" (no decimals, thousands separator)
 *  - USD → "$1.000,00" (2 decimals)
 *  - Invalid amount → em dash
 *  - Unknown currency → currency-prefixed raw amount fallback
 *
 * Approach: Instantiate pipe directly (no TestBed needed for pure pipes),
 * call transform() with controlled inputs, assert exact output strings.
 */
```

A spec file without this header fails the reviewer gate.

---

## 2. Structure

- **AAA**: Arrange (build inputs/mocks) → Act (call the unit once) → Assert (verify
  the observable outcome).
- **One scenario per test.** No test that asserts three unrelated things.
- **Naming**: descriptive, states the contract — e.g. `'formats COP with no decimal places'`.

---

## 3. Assertion quality

Assert the **observable contract**, not a side effect or a weak signal.

### Strong assertions

- Deterministic results → assert the **exact** value/structure.
- HTTP services → assert method, URL, **and** request body/params.
- Components → assert rendered content with **contextual** selectors (not bare `textContent`).
- Pipes → assert **exact** output string, not partial `toContain`.

### Forbidden anti-patterns

| Pattern | Why it's weak |
|---|---|
| `expect(text).toContain('X')` as sole assertion on rendering | Passes if X appears anywhere, including wrong place |
| `expect(element).toBeTruthy()` alone | Almost always true; doesn't verify content |
| `expect(component).toBeDefined()` | Verifies nothing meaningful |
| Asserting "no exception"/"didn't crash" | Verifies nothing about the outcome |
| `expect(x).not.toBeNull()` alone | Almost always passes |
| Reading private state (`component._internal`) | Tests implementation, not behavior |

### Example: weak → strong

Weak:
```typescript
it('renders product name', async () => {
  const fixture = await setup();
  const text = fixture.nativeElement.textContent;
  expect(text).toContain('Hamburguesa');
});
```

Passes even if the name appears in a footer, tooltip, or error message.

Strong:
```typescript
it('renders product name in the title element', async () => {
  const fixture = await setup();
  const title = fixture.nativeElement.querySelector('[data-testid="product-title"]');
  expect(title?.textContent?.trim()).toBe('Hamburguesa');
});
```

---

## 4. Mocking: only at boundaries

- Mock **external** boundaries: HttpClient, WebSocket, router, localStorage, timers.
- **Never** mock the unit's own internal logic. A test that mocks everything the
  component does passes no matter what the implementation does.
- For Angular services: use `HttpTestingController` to intercept and verify requests.
- For components: mock injected services via `{ provide: ServiceClass, useValue: stub }`.
- Assert mocks were called with the **exact** contract arguments, not just "called".

---

## 5. Minimum coverage per new unit

For every new component, service, pipe, or method, ship at minimum:

1. **Happy path** — exact expected result.
2. **Error paths** — each error branch (HTTP error, validation failure, null input).
3. **Edge cases** — empty input, `undefined`, `null`, boundaries, special characters.
4. **Security-relevant inputs** where applicable — HTML escaping, injection.

A new unit without all four is not `done`; the reviewer must reject it.

---

## 6. Angular-specific rules

- **Pure pipes**: test directly with `new PipeClass()` — no TestBed needed.
- **Impure pipes / pipes with DI**: use `TestBed` with `PipeTransform`.
- **Components**: use `TestBed.configureTestingModule` with `imports: [Component]`.
  Use `resolveComponentResources` in `beforeAll` for external templates.
- **Services with HttpClient**: always use `HttpTestingController` + `provideHttpClientTesting()`.
  Call `httpMock.verify()` in `afterEach` to assert no unmatched requests.
- **Signals**: read signal values with `component.signalName()` in assertions.
- **Forms**: assert `FormControl.value`, `FormGroup.valid`, not DOM state for unit tests.
- **Fake timers**: use `vi.useFakeTimers()` + `vi.advanceTimersByTime()` for debounce/delay.
  Always call `vi.useRealTimers()` in `afterEach`.

---

## 7. Reviewer gate

The reviewer checks every PR/activity against this policy:

- [ ] File header present with feature description, contract, and approach
- [ ] Mutation mindset: each test would fail if its unit were broken
- [ ] Exact-value assertions; no `toContain` as sole rendering assertion
- [ ] Negative + edge paths tested for every new entry point
- [ ] Mocks only at boundaries; call arguments asserted precisely
- [ ] No private-state access in tests
- [ ] Deterministic: no randomness, no wall-clock asserts without frozen time
- [ ] TestBed setup uses `resetTestingModule` between tests
- [ ] `httpMock.verify()` called in `afterEach` for HTTP tests
