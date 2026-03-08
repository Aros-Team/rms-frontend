import { Component } from '@angular/core';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'rms-toast',
  standalone: true,
  imports: [ToastModule],
  templateUrl: './rms-toast.component.html',
  providers: [MessageService],
})
export class RmsToastComponent {
  readonly messageService = MessageService;
}
