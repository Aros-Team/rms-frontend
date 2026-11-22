import { defineSmokeSuite } from '../support/smoke-suite';
import { ROLE_ROUTES } from '../support/routes';

defineSmokeSuite('cashier', ROLE_ROUTES.cashier, { authenticated: true });
