#!/usr/bin/env node
/**
 * P5-H-02 — request-shape guard.
 *
 * Reads the live OpenAPI document from the running API and checks the JSON
 * bodies the Angular client actually sends (representative endpoints) against
 * the request schemas:
 *
 *   - every key in the sample must exist in the schema (no unknown fields);
 *   - every required schema property must be present in the sample;
 *   - object/array nesting is followed, including `$ref` and `allOf`.
 *
 * Scalar types are intentionally NOT compared: the API declares money as JSON
 * numbers (`BigDecimal`) while the client sends decimal strings, a known
 * contract drift tracked separately (see the lane report). This guard catches
 * field-level drift, which is what silently breaks requests.
 *
 * Usage:
 *   npm run contract:shapes
 *   OPENAPI_URL=... npm run contract:shapes
 *   npm run contract:shapes -- --allow-missing-spec   # skip if API is down
 *
 * Exit codes: 0 pass/skip, 1 drift or unreachable spec.
 */

const SPEC_URL = process.env.OPENAPI_URL ?? 'http://localhost:8080/v3/api-docs';
const allowMissingSpec = process.argv.includes('--allow-missing-spec');

/** Request bodies mirrored from the DTOs in `src/app/shared/models/dto`. */
const CASES = [
  {
    method: 'post',
    path: 'auth/login',
    body: { username: 'admin1@rms.local', password: 'secret', deviceHash: 'device-hash' },
  },
  {
    method: 'post',
    path: 'auth/reset-password',
    body: { token: 'reset-token', newPassword: 'new-secret' },
  },
  {
    method: 'post',
    path: 'v1/orders',
    body: {
      tableId: 1,
      details: [
        {
          productId: 10,
          instructions: 'sin cebolla',
          selectedOptionIds: [1, 2],
          selectedProductIds: [3],
          additionIds: [4],
          clarifications: [{ questionId: 5, answer: 'bien cocido' }],
        },
      ],
    },
  },
  {
    method: 'put',
    path: 'v1/orders/{id}',
    body: {
      tableId: 1,
      details: [{ productId: 10, instructions: '', selectedOptionIds: [] }],
    },
  },
  {
    method: 'post',
    path: 'v1/tables',
    body: { tableNumber: 12, capacity: 4 },
  },
  {
    method: 'post',
    path: 'v1/products',
    body: {
      name: 'Producto',
      description: '',
      basePrice: 25000,
      categoryId: 1,
      areaId: 1,
      recipe: [{ supplyVariantId: 7, requiredQuantity: 2 }],
      optionIds: [],
      optionExtras: [{ optionId: 1, extraPrice: 1000 }],
      estimatedPrepMinutes: 10,
    },
  },
  {
    method: 'post',
    path: 'v1/product-options',
    body: {
      name: 'Opción',
      optionGroupId: 1,
      recipe: [{ supplyVariantId: 7, requiredQuantity: 1 }],
    },
  },
  {
    method: 'post',
    path: 'v1/payments',
    body: {
      orderId: 1,
      tipAmount: '5000.00',
      discount: { type: 'PERCENT', value: '10.00', reason: 'Cortesía' },
      tenders: [{ method: 'CASH', amount: '58000.00', reference: null }],
    },
  },
  {
    method: 'patch',
    path: 'v1/users/{id}/role',
    body: { role: 'ADMIN' },
  },
  {
    method: 'post',
    path: 'v1/inventory/transfer',
    body: { items: [{ supplyVariantId: 7, quantity: 3 }] },
  },
];

function resolve(spec, schema) {
  let current = schema;
  let guard = 0;
  while (current && typeof current === 'object' && '$ref' in current && guard < 20) {
    const ref = current.$ref;
    if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref: ${ref}`);
    current = ref
      .slice(2)
      .split('/')
      .reduce((node, part) => node?.[part], spec);
    guard += 1;
  }
  return current;
}

/** Merge `allOf` members into one object schema so required/properties add up. */
function flatten(spec, schema) {
  const resolved = resolve(spec, schema);
  if (!resolved || typeof resolved !== 'object' || !Array.isArray(resolved.allOf)) {
    return resolved;
  }
  const merged = { ...resolved, properties: {}, required: [] };
  for (const member of resolved.allOf) {
    const flat = flatten(spec, member);
    Object.assign(merged.properties, flat.properties ?? {});
    merged.required.push(...(flat.required ?? []));
  }
  delete merged.allOf;
  return merged;
}

function check(spec, sample, schema, path, errors) {
  const flat = flatten(spec, schema);
  if (!flat || typeof flat !== 'object') return;

  if (flat.type === 'array' || Array.isArray(sample)) {
    if (!Array.isArray(sample)) {
      errors.push(`${path}: expected an array, got ${typeof sample}`);
      return;
    }
    for (const [index, item] of sample.entries()) {
      check(spec, item, flat.items ?? {}, `${path}[${index}]`, errors);
    }
    return;
  }

  if (typeof sample !== 'object' || sample === null) return;

  const properties = flat.properties ?? {};
  const required = flat.required ?? [];
  const freeForm = flat.additionalProperties === true || Object.keys(properties).length === 0;

  for (const field of required) {
    if (!(field in sample)) errors.push(`${path}: missing required field "${field}"`);
  }

  for (const [key, value] of Object.entries(sample)) {
    if (!(key in properties)) {
      if (!freeForm) errors.push(`${path}: unknown field "${key}"`);
      continue;
    }
    check(spec, value, properties[key], `${path}.${key}`, errors);
  }
}

function operationFor(spec, method, path) {
  const candidates = [`/api/${path}`, `/${path}`];
  for (const candidate of candidates) {
    const item = spec.paths?.[candidate];
    if (item?.[method]) return { candidate, operation: item[method] };
  }
  return null;
}

async function main() {
  let spec;
  try {
    const response = await fetch(SPEC_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    spec = await response.json();
  } catch (error) {
    const message = `[contract:shapes] cannot read ${SPEC_URL}: ${error.message}`;
    if (allowMissingSpec) {
      console.log(`SKIP ${message} (--allow-missing-spec)`);
      return;
    }
    console.error(`${message}\nStart the API or pass --allow-missing-spec to skip.`);
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  for (const testCase of CASES) {
    const method = testCase.method.toLowerCase();
    const found = operationFor(spec, method, testCase.path);
    const label = `${method.toUpperCase()} ${testCase.path}`;

    if (!found) {
      console.error(`FAIL ${label} — operation not in OpenAPI`);
      failures += 1;
      continue;
    }

    const schema = found.operation.requestBody?.content?.['application/json']?.schema;
    if (!schema) {
      console.error(`FAIL ${label} — no application/json request body in OpenAPI`);
      failures += 1;
      continue;
    }

    const errors = [];
    check(spec, testCase.body, schema, 'body', errors);
    if (errors.length) {
      failures += 1;
      console.error(`FAIL ${label}`);
      for (const error of errors) console.error(`  - ${error}`);
    } else {
      console.log(`ok   ${label}`);
    }
  }

  if (failures) {
    console.error(`\n[contract:shapes] ${failures} request shape(s) drifted from ${SPEC_URL}`);
    process.exitCode = 1;
  } else {
    console.log(`\n[contract:shapes] ${CASES.length} request shapes match ${SPEC_URL}`);
  }
}

await main();
