import { LambdaFunctionURLEvent, LambdaFunctionURLResult } from "aws-lambda";
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';

const delay = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
const TaskA = async (req: string) => {
  await delay(1000);
  console.log("TaskA ", req );
  return { name: "TaskA" };
}

const TaskB = async (name: string, req: string) => {
  await delay(1000);
  console.log("TaskB", req );
  return { name };
}

const TaskC = async (req: string) => {
  await delay(1000);
  console.log("TaskC", req );
  return { name: "TaskAC" };
}
export const handler = async (_event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
  if (isMainThread) {
    module.exports = function parseJSAsync(script) {
      return new Promise((resolve, reject) => {
        const worker = new Worker(__filename, {
          workerData: script,
        });
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0)
            reject(new Error(`Worker stopped with exit code ${code}`));
        });
      });
    };
  } else {
    const { parse } = require('some-js-parsing-library');
    const script = workerData;
    parentPort.postMessage(parse(script));
  } 
  const resultA = await TaskA(_event.requestContext.requestId);
  const resultB = TaskB(resultA.name,_event.requestContext.requestId);
  const resultC = TaskC(_event.requestContext.requestId);

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