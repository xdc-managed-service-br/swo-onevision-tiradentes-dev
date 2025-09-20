// src/app/components/dashboard/region-distribution-card.component.ts
import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegionDistribution } from '../../../core/services/metric-processor.service';

@Component({
  selector: 'app-region-distribution-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: `./region-distribution-card.component.html`,
  styleUrls: ['./region-distribution-card.component.css']
})
export class RegionDistributionCardComponent implements OnInit {
  @Input() regionDistribution: RegionDistribution[] = [];

  ngOnInit() {
    // Limita a 10 principais regiões se houver muitas
    if (this.regionDistribution.length > 10) {
      this.regionDistribution = this.regionDistribution.slice(0, 10);
    }
  }
}