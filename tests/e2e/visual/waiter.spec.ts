import { defineVisualSuite } from '../support/visual-suite';
import { ROLE_ROUTES } from '../support/routes';

defineVisualSuite('waiter', ROLE_ROUTES.waiter, { authenticated: true });
