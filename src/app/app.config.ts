// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { MetricProcessorService } from './core/services/metric-processor.service';
import { MetricService } from './core/services/metric.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    MetricProcessorService,
    MetricService
  
  ]
};
