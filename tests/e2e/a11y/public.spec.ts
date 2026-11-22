import { defineA11ySuite } from '../support/a11y-suite';
import { PUBLIC_ROUTES } from '../support/routes';

defineA11ySuite('public', PUBLIC_ROUTES, { authenticated: false });
