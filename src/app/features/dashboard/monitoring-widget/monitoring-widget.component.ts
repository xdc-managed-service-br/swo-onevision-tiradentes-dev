// src/app/features/dashboard/monitoring-widget/monitoring-widget.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-monitoring-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './monitoring-widget.component.html',
  styleUrls: ['./monitoring-widget.component.css']
})
export class MonitoringWidgetComponent {
  /** Título do card (ex: "Disk Monitoring") */
  @Input() title = 'Monitoring';

  /** Percentual (0–100) */
  @Input() percentage = 0;

  /** Texto auxiliar (ex: "Active Monitoring on Resources") */
  @Input() label = '';

  /** Cor opcional da barra (hex/rgb), fallback para var(--ov-accent) */
  @Input() color?: string;

  clamp(p: number): number {
    if (p < 0) return 0;
    if (p > 100) return 100;
    return Math.round(p);
  }
}