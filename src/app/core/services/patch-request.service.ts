import { Injectable } from '@angular/core';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../../amplify/data/resource';
import { fetchUserAttributes } from 'aws-amplify/auth';

const client = generateClient<Schema>();

@Injectable({
  providedIn: 'root'
})
export class PatchRequestService {

  async createPatchRequest(instanceId: string, action: string, notes?: string) {
    const attributes = await fetchUserAttributes();
    const email = attributes.email ?? 'unknown@onevision.local';

    return client.models.PatchRequest.create({
      id: crypto.randomUUID(),
      instanceId,
      action,
      status: 'PENDING',
      requestedBy: email,
      requestedAt: new Date().toISOString(),
      notes: notes || ''
    });
  }


  async updatePatchRequest(id: string, status: string, approvedBy?: string) {
    const attributes = await fetchUserAttributes();
    const approver = approvedBy ?? attributes.email ?? 'admin@onevision.local';

    return client.models.PatchRequest.update({
      id,
      status,
      approvedBy: approver,
      approvedAt: new Date().toISOString()
    });
  }

  async listPatchRequests() {
    return client.models.PatchRequest.list();
  }

  async deletePatchRequest(id: string) {
    return client.models.PatchRequest.delete({ id });
  }
}