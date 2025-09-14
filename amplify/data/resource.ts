// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  AWSResource: a.model({
    // ===== BASE FIELDS =====
    id: a.string().required(),
    resourceType: a.string().required(),
    accountId: a.string().required(),
    region: a.string().required(),
    createdAt: a.datetime().required(),
    updatedAt: a.datetime().required(),

    // ===== BASE OPTIONAL FIELDS =====
    accountName: a.string(),
    tags: a.json(),

    // ===== AMI FIELDS =====
    imageId: a.string(),
    imageName: a.string(),
    imageState: a.string(),
    description: a.string(),
    platform: a.string(),

    // ===== ASG FIELDS =====
    autoScalingGroupArn: a.string(),
    autoScalingGroupName: a.string(),
    autoScalingGroupNameTag: a.string(),
    availabilityZones: a.string().array(),
    currentSize: a.integer(),
    desiredCapacity: a.integer(),
    healthCheckGracePeriod: a.integer(),
    healthCheckType: a.string(),
    healthyInstances: a.integer(),
    instanceIds: a.string().array(),
    launchTemplate: a.json(),
    maxSize: a.integer(),
    minSize: a.integer(),
    serviceLinkedRoleArn: a.string(),
    vpcZoneIdentifier: a.string()
  })
  .authorization(allow => [
    allow.authenticated().to(['read']),
    allow.group('Admins').to(['read','create', 'update', 'delete']),
    allow.publicApiKey().to(['create', 'update'])
  ])
  .secondaryIndexes(index => [
    index('resourceType')
      .queryField('listByResourceType')
      .sortKeys(['createdAt']),
    index('accountId')
      .queryField('listByAccountId')
      .sortKeys(['resourceType'])
  ]),

  PatchRequest: a.model({
    id: a.string().required(),
    instanceId: a.string().required(),
    action: a.string().required(),
    status: a.string().required(),
    requestedBy: a.string().required(),
    requestedAt: a.datetime().required(),
    approvedBy: a.string(),
    approvedAt: a.datetime(),
    notes: a.string()
  })
  .authorization(allow => [
    allow.authenticated().to(['create', 'read']),
    allow.group('Admins').to(['create', 'update', 'delete', 'read'])
  ]),

  ResourceComment: a.model({
    id: a.string().required(),
    resourceId: a.string().required(),
    author: a.string().required(),
    text: a.string().required(),
    createdAt: a.datetime().required()
  })
  .authorization(allow => [
    allow.authenticated().to(['create', 'read']),
    allow.group('Admins').to(['create', 'update', 'delete', 'read']),
    allow.owner().to(['delete'])
  ])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 30 }
  }
});