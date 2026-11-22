import { defineSmokeSuite } from '../support/smoke-suite';
import { ROLE_ROUTES } from '../support/routes';

defineSmokeSuite('admin', ROLE_ROUTES.admin, { authenticated: true });
