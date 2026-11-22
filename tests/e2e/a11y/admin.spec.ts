import { defineA11ySuite } from '../support/a11y-suite';
import { ROLE_ROUTES } from '../support/routes';

defineA11ySuite('admin', ROLE_ROUTES.admin, { authenticated: true });
