import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
const client = new SQSClient({region: process.env.AWS_REGION,})

const delay = async (ms: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}


export const Task = async (req: string, name: string, sleep: number, extendProcess?: Function, id?: string) => {
  console.log(`Starting ${name} : `, req );
  await delay(sleep);
  console.log(`Waking up ${name} : `, req );
  if( extendProcess ){ extendProcess(name, req, id); }
  await client.send(new SendMessageCommand({
    QueueUrl: process.env.QUEUE_URL,
    MessageBody: JSON.stringify({ req, name }),
  }));
  console.log(`End ${name} : `, req );
  return { name: `${name}` };
}