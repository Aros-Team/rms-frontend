import { defineSmokeSuite } from '../support/smoke-suite';
import { ROLE_ROUTES } from '../support/routes';

defineSmokeSuite('waiter', ROLE_ROUTES.waiter, { authenticated: true });
