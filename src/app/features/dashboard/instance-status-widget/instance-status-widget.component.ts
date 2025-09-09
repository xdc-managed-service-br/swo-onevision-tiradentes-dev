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
  /** Totais (os únicos obrigatórios no seu template são total/running/stopped) */
  @Input() total = 0;
  @Input() running = 0;
  @Input() stopped = 0;
  @Input() pending = 0;
  @Input() terminated = 0;

  get runningPct(): number {
    return this.total > 0 ? Math.round((this.running / this.total) * 100) : 0;
  }
}