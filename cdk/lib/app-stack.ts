import { Stack, StackProps, Duration } from 'aws-cdk-lib/core';
import { Runtime, FunctionUrlAuthType, InvokeMode, Architecture, HttpMethod, LoggingFormat, ApplicationLogLevel, SystemLogLevel } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { Distribution, CachePolicy, HttpVersion, ViewerProtocolPolicy, OriginRequestPolicy, CfnOriginAccessControl, CfnDistribution } from 'aws-cdk-lib/aws-cloudfront';
import { FunctionUrlOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { resolve } from 'path';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Queue } from 'aws-cdk-lib/aws-sqs';

export class LambdaConcurrencyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const { account: accountId } = Stack.of(this);

    const queue = new Queue(this, 'Queue');
    const lambdaServiceRole = new ServicePrincipal('lambda.amazonaws.com');
    const lambdaFunctionRole = new Role(this, `AllLambdaRole`, {
      assumedBy: lambdaServiceRole,
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    const awaited = new NodejsFunction(this, `AwaitedLambdaFunction`, {
      runtime: Runtime.NODEJS_20_X,
      entry: resolve(__dirname, '../../src/handler/awaited/index.ts'),
      timeout: Duration.seconds(15),
      memorySize: 1024,
      architecture: Architecture.ARM_64,
      role: lambdaFunctionRole,
      environment: {
        QUEUE_URL: queue.queueUrl,
      }
    });
    const nonAwaited = new NodejsFunction(this, `NonAwaitedLambdaFunction`, {
      runtime: Runtime.NODEJS_20_X,
      entry: resolve(__dirname, '../../src/handler/non-awaited/index.ts'),
      timeout: Duration.seconds(15),
      memorySize: 1024,
      architecture: Architecture.ARM_64,
      role: lambdaFunctionRole,
      environment: {
        QUEUE_URL: queue.queueUrl,
      }
    });

    const failingNonAwaited = new NodejsFunction(this, `FailingNonAwaitedLambdaFunction`, {
      runtime: Runtime.NODEJS_20_X,
      entry: resolve(__dirname, '../../src/handler/failing-non-awaited/index.ts'),
      timeout: Duration.seconds(15),
      memorySize: 1024,
      architecture: Architecture.ARM_64,
      role: lambdaFunctionRole,
      environment: {
        QUEUE_URL: queue.queueUrl,
      }
    });

    const stateNonAwaited = new NodejsFunction(this, `StateNonAwaitedLambdaFunction`, {
      runtime: Runtime.NODEJS_20_X,
      entry: resolve(__dirname, '../../src/handler/non-awaited-state-tracking/index.ts'),
      timeout: Duration.seconds(15),
      memorySize: 1024,
      architecture: Architecture.ARM_64,
      loggingFormat: LoggingFormat.JSON,
      applicationLogLevelV2: ApplicationLogLevel.TRACE,
      systemLogLevelV2: SystemLogLevel.DEBUG,
      role: lambdaFunctionRole,
      environment: {
        QUEUE_URL: queue.queueUrl,
      }
    });

    queue.grantSendMessages(lambdaFunctionRole);
    
    new LogGroup(this, `AwaitedLambdaLogGroup`, {
      retention: RetentionDays.ONE_DAY,
      logGroupName: `/aws/lambda/${awaited.functionName}`
    });

    new LogGroup(this, `NonAwaitedLambdaLogGroup`, {
      retention: RetentionDays.ONE_DAY,
      logGroupName: `/aws/lambda/${nonAwaited.functionName}`
    });

    new LogGroup(this, `FailingNonAwaitedLambdaLogGroup`, {
      retention: RetentionDays.ONE_DAY,
      logGroupName: `/aws/lambda/${failingNonAwaited.functionName}`
    });
    new LogGroup(this, `StateNonAwaitedLambdaLogGroup`, {
      retention: RetentionDays.ONE_DAY,
      logGroupName: `/aws/lambda/${stateNonAwaited.functionName}`
    });

    const awaitedUrl = awaited.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      invokeMode: InvokeMode.RESPONSE_STREAM,
      cors: {
          allowCredentials: true,
          allowedHeaders: ['*'],
          allowedMethods: [ HttpMethod.ALL ],
          allowedOrigins: [ '*' ],
          maxAge: Duration.days(1),
      },
    });

    const nonAwaitedUrl = nonAwaited.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      invokeMode: InvokeMode.RESPONSE_STREAM,
      cors: {
          allowCredentials: true,
          allowedHeaders: ['*'],
          allowedMethods: [ HttpMethod.ALL ],
          allowedOrigins: [ '*' ],
          maxAge: Duration.days(1),
      },
    });

    const failingNonAwaitedUrl = failingNonAwaited.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      invokeMode: InvokeMode.RESPONSE_STREAM,
      cors: {
          allowCredentials: true,
          allowedHeaders: ['*'],
          allowedMethods: [ HttpMethod.ALL ],
          allowedOrigins: [ '*' ],
          maxAge: Duration.days(1),
      },
    });
    const stateNonAwaitedUrl = stateNonAwaited.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      invokeMode: InvokeMode.RESPONSE_STREAM,
      cors: {
          allowCredentials: true,
          allowedHeaders: ['*'],
          allowedMethods: [ HttpMethod.ALL ],
          allowedOrigins: [ '*' ],
          maxAge: Duration.days(1),
      },
    });
    


    const distribution = new Distribution(this, `CloudFrontDistribution`, {
      defaultBehavior: {
        origin: new FunctionUrlOrigin(awaitedUrl),
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
      },
      httpVersion: HttpVersion.HTTP2_AND_3,
      additionalBehaviors: {
        '/non-awaited': {
          origin: new FunctionUrlOrigin(nonAwaitedUrl),
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        },
        '/non-awaited/fail': {
          origin: new FunctionUrlOrigin(failingNonAwaitedUrl),
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        },
        '/non-awaited/state': {
          origin: new FunctionUrlOrigin(stateNonAwaitedUrl),
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
        },
      }
    });

    const lambdaOriginAccessControl = new CfnOriginAccessControl(this, 'LambdaUrlOAC', {
      originAccessControlConfig: {
          name: `Lambda-URL-OAC`,
          originAccessControlOriginType: 'lambda',
          signingBehavior: 'always',
          signingProtocol: 'sigv4',
      },
    });

    awaitedUrl.grantInvokeUrl(new ServicePrincipal('cloudfront.amazonaws.com', {
      conditions: {
          ArnLike: {
              'aws:SourceArn': `arn:aws:cloudfront::${accountId}:distribution/${distribution.distributionId}`,
          },
          StringEquals: {
              'aws:SourceAccount': accountId,
          },
      }
    }));

    nonAwaitedUrl.grantInvokeUrl(new ServicePrincipal('cloudfront.amazonaws.com', {
      conditions: {
          ArnLike: {
              'aws:SourceArn': `arn:aws:cloudfront::${accountId}:distribution/${distribution.distributionId}`,
          },
          StringEquals: {
              'aws:SourceAccount': accountId,
          },
      }
    }));

    failingNonAwaitedUrl.grantInvokeUrl(new ServicePrincipal('cloudfront.amazonaws.com', {
      conditions: {
          ArnLike: {
              'aws:SourceArn': `arn:aws:cloudfront::${accountId}:distribution/${distribution.distributionId}`,
          },
          StringEquals: {
              'aws:SourceAccount': accountId,
          },
      }
    }));

    stateNonAwaitedUrl.grantInvokeUrl(new ServicePrincipal('cloudfront.amazonaws.com', {
      conditions: {
          ArnLike: {
              'aws:SourceArn': `arn:aws:cloudfront::${accountId}:distribution/${distribution.distributionId}`,
          },
          StringEquals: {
              'aws:SourceAccount': accountId,
          },
      }
    }));

    const cfCfnDist = distribution.node.defaultChild as CfnDistribution;
    cfCfnDist.addPropertyOverride(
        'DistributionConfig.Origins.0.OriginAccessControlId',
        lambdaOriginAccessControl.getAtt('Id')
    );

    cfCfnDist.addPropertyOverride(
      'DistributionConfig.Origins.1.OriginAccessControlId',
      lambdaOriginAccessControl.getAtt('Id')
    );

    cfCfnDist.addPropertyOverride(
      'DistributionConfig.Origins.2.OriginAccessControlId',
      lambdaOriginAccessControl.getAtt('Id')
    );

    cfCfnDist.addPropertyOverride(
      'DistributionConfig.Origins.3.OriginAccessControlId',
      lambdaOriginAccessControl.getAtt('Id')
    );
  }
}