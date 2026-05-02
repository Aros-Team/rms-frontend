import { Component } from '@angular/core';

import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-manage',
  imports: [RouterModule],
  templateUrl: './manage.html',
  styles: ``
})
export class Manage {
  activeSection = 'staff';

  sections = [
    { id: 'staff', label: 'Trabajadores', icon: 'pi pi-users' },
    { id: 'tables', label: 'Mesas', icon: 'pi pi-table' },
    { id: 'areas', label: 'Áreas de trabajo', icon: 'pi pi-th-large' },
    { id: 'categories', label: 'Categorías', icon: 'pi pi-folder' }
  ];
}
