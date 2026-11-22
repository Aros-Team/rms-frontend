import { defineA11ySuite } from '../support/a11y-suite';
import { ROLE_ROUTES } from '../support/routes';

defineA11ySuite('waiter', ROLE_ROUTES.waiter, { authenticated: true });
