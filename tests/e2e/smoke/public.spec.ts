import { defineSmokeSuite } from '../support/smoke-suite';
import { PUBLIC_ROUTES } from '../support/routes';

defineSmokeSuite('public', PUBLIC_ROUTES, { authenticated: false });
