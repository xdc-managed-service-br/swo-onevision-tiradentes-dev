// src/app/dashboard/instance-status-widget/instance-status-widget.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-instance-status-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './instance-status-widget.component.html',
  styleUrls: ['./instance-status-widget.component.css']
})
export class InstanceStatusWidgetComponent {
  @Input() total: number = 0;
  @Input() running: number = 0;
  @Input() stopped: number = 0;
}