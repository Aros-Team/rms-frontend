import { defineVisualSuite } from '../support/visual-suite';
import { PUBLIC_ROUTES } from '../support/routes';

defineVisualSuite('public', PUBLIC_ROUTES, { authenticated: false });
