import { defineVisualSuite } from '../support/visual-suite';
import { ROLE_ROUTES } from '../support/routes';

defineVisualSuite('kitchen', ROLE_ROUTES.kitchen, { authenticated: true });
