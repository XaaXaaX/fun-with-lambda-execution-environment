


import { LambdaFunctionURLEvent, LambdaFunctionURLResult } from "aws-lambda";
import { Task } from "../../handler/shared";

const extendedProcess = (name: string, req: string) => {
  console.log(`Failing ${name} : `, req );
  throw new Error('TaskB Failed');
}

export const handler = async (_event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
  const resultA = await Task(_event.requestContext.requestId, "TaskA", 1000);
  const resultB = Task(_event.requestContext.requestId, "TaskB", 2000, extendedProcess("TaskB", _event.requestContext.requestId));
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