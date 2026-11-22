import { defineVisualSuite } from '../support/visual-suite';
import { ROLE_ROUTES } from '../support/routes';

defineVisualSuite('admin', ROLE_ROUTES.admin, { authenticated: true });
