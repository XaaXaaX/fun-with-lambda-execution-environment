import { LambdaFunctionURLEvent, LambdaFunctionURLResult } from "aws-lambda";
import { Task } from "../../handler/shared";

export const handler = async (_event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
  const resultA = await Task(_event.requestContext.requestId, "TaskA", 1000);
  const resultB = Task(_event.requestContext.requestId, "TaskB", 2000);
  const resultC = Task(_event.requestContext.requestId, "TaskC", 3000);

  const result = {
    resultA,
    resultB,
    resultC,
  };
  return {
    statusCode: 200,
    body: JSON.stringify(result, null, 2),
    headers: {
      "Content-Type": "application/json",
    },
  };
}