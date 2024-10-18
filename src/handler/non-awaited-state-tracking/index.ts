import { LambdaFunctionURLEvent, LambdaFunctionURLResult } from "aws-lambda";
import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
const client = new SQSClient({region: process.env.AWS_REGION,})

let taskBEvents =  new Map<string, { name: string, req: string }[]>();

const Task = async (req: string, name: string, time: number, extendProcess?: Function, id?: string) => {
  console.log(`${name} Start : `, req );
  if( extendProcess ) { await extendProcess(name, req, id, time); }
  console.log(`${name} End : `, req );
  return { name, req };
}

const delay = async (ms: number) => { return new Promise((resolve) => { setTimeout(resolve, ms); }); }

const samplingExtendedProcess = async (name: string, req: string, id: string, time: number) => {
  await delay(200);
  const logs = taskBEvents.get(id) ?? [];
  taskBEvents.set(id, [ ...logs , {name, req}])
  
  console.log(`${name} taskBEvents ${id}`, taskBEvents);
  if (logs.length < 10 ) return;
  
  await client.send(new SendMessageBatchCommand({
    QueueUrl: process.env.QUEUE_URL,
    Entries: logs.map((item) => ({
      Id: item.req,
      MessageBody: JSON.stringify({ item }),
    }))
  }));

  taskBEvents.delete(id);
  
  console.log(`${name} Dispatched ${time} ${id} ` );
}

export const handler = async (_event: LambdaFunctionURLEvent): Promise<LambdaFunctionURLResult> => {
  const id = _event.headers['x-entity-id'];
  await Task(_event.requestContext.requestId, "TaskA", new Date().getTime());  
  Task(_event.requestContext.requestId, "TaskB", new Date().getTime(), samplingExtendedProcess, id);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "OK" }, null, 2),
    headers: {
      "Content-Type": "application/json",
    },
  };
}