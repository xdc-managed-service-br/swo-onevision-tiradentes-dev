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
    platform: a.string()
    
  })
  .authorization(allow => [
    // Leitura para usuários autenticados
    allow.authenticated().to(['read']),
    // Escrita restrita para grupo de administradores
    allow.group('Admins').to(['read','create', 'update', 'delete']),
    // API Key para processos de coleta automatizada
    allow.publicApiKey().to(['create', 'update'])
  ])
  .secondaryIndexes(index => [
  // Índice por tipo de recurso → ordenado pela data de criação
  index('resourceType')
    .queryField('listByResourceType')
    .sortKeys(['createdAt']),
  // Índice por conta → agrupado por tipo de recurso
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

// Configuração e export do data
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { 
      expiresInDays: 30 
    }
  }
});