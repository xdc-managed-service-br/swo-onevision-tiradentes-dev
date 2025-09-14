import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const lambda = new LambdaClient({});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const FunctionName = "OneVisionDataCollectorFunction";

    await lambda.send(new InvokeCommand({
      FunctionName,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify({})),
    }));

    return {
      statusCode: 202,
      headers: cors,
      body: JSON.stringify({ ok: true, message: "Collector triggered" }),
    };
  } catch (err: any) {
    console.error("Error invoking collector:", err);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ ok: false, error: err?.message ?? "invoke failed" }),
    };
  }
};