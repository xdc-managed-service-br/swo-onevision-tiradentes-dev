// src/app/dashboard/monitoring-widget/monitoring-widget.component.ts
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
  @Input() title: string = '';
  @Input() percentage: number = 0;
  @Input() label: string = '';
  @Input() color: string = '#4fd1c5';
  @Input() bgColor: string = '#e6e6e6';
}