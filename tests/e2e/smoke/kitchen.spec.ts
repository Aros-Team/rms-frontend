import { defineSmokeSuite } from '../support/smoke-suite';
import { ROLE_ROUTES } from '../support/routes';

defineSmokeSuite('kitchen', ROLE_ROUTES.kitchen, { authenticated: true });
