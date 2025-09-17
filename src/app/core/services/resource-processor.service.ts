// src/app/core/services/resource-processor.service.ts
import { Injectable } from '@angular/core';
import type { AWSResourceModel } from '../../models/resource.model';

@Injectable({ providedIn: 'root' })
export class ResourceProcessorService {
  constructor() {}

  public processResourceData(resource: any): AWSResourceModel {
    const processed: any = { ...resource };

    if (processed.resourceType === 'EC2Instance') {
      // 1) Nullables → undefined (to align with interface)
      const strFields = [
        'instanceName', 'instanceType', 'instanceState', 'platformDetails',
        'amiName', 'iamRole', 'patchGroup', 'healthStatus',
        'systemStatus', 'instanceStatus', 'ebsStatus',
        'ssmStatus', 'ssmPingStatus', 'ssmVersion',
        'swoMonitor', 'swoPatch', 'swoBackup', 'swoRiskClass', 'instanceId'
      ];
      for (const f of strFields) {
        if (processed[f] === null) processed[f] = undefined;
      }

      // 2) Required fields fallback
      if (!processed.instanceType) processed.instanceType = 'unknown';

      // 3) Ensure arrays
      if (!Array.isArray(processed.instancePrivateIps)) {
        processed.instancePrivateIps = Array.isArray(processed.privateIpArray) ? processed.privateIpArray : [];
      }
      if (!Array.isArray(processed.instancePublicIps)) {
        processed.instancePublicIps = Array.isArray(processed.publicIpArray) ? processed.publicIpArray : [];
      }

      // 4) Coerce booleans
      processed.cwAgentMemoryDetected = !!processed.cwAgentMemoryDetected;
      processed.cwAgentDiskDetected   = !!processed.cwAgentDiskDetected;

      // 5) launchTime fallback
      if (processed.launchTime == null) {
        if (processed.updatedAt) processed.launchTime = processed.updatedAt;
        else if (processed.createdAt) processed.launchTime = processed.createdAt;
      }
    }

    return processed as AWSResourceModel;
  }
}