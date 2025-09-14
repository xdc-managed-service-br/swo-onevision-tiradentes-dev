// amplify/backend.ts
import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { defineFunction } from "@aws-amplify/backend-function";
// CDK imports
import { Stack } from "aws-cdk-lib";
import { HttpApi, HttpMethod, CorsHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpIamAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

const triggerCollector = defineFunction({
  name: "trigger-collector",
  entry: "./functions/trigger-collector/index.ts",
});

const backend = defineBackend({ auth, data, triggerCollector });

const apiStack = backend.createStack("onevision-api-stack");

const iamAuthorizer = new HttpIamAuthorizer();

const httpLambdaIntegration = new HttpLambdaIntegration(
  "TriggerCollectorIntegration",
  backend.triggerCollector.resources.lambda
);

const httpApi = new HttpApi(apiStack, "OneVisionHttpApi", {
  apiName: "onevision-http-api",
  corsPreflight: {
    allowMethods: [CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
    allowOrigins: ["*"],
    allowHeaders: ["*"],
  },
  createDefaultStage: true,
});

httpApi.addRoutes({
  path: "/refresh",
  methods: [HttpMethod.POST],
  integration: httpLambdaIntegration,
  authorizer: iamAuthorizer,
});

backend.triggerCollector.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ["lambda:InvokeFunction"],
  resources: ["arn:aws:lambda:*:*:function:OneVisionDataCollectorFunction"],
}));

backend.addOutput({
  custom: {
    API: {
      [httpApi.httpApiName!]: {
        endpoint: httpApi.url,
        region: Stack.of(httpApi).region,
        apiName: httpApi.httpApiName,
      },
    },
  },
});

export const backendOut = backend;