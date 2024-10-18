#!/usr/bin/env node
import 'source-map-support/register';
import { LambdaConcurrencyStack } from '../lib/app-stack';
import { App, Aspects } from 'aws-cdk-lib';
import { ApplyDestroyPolicyAspect } from '../helpers/stack';

const app = new App();
new LambdaConcurrencyStack(app, LambdaConcurrencyStack.name , {});

Aspects.of(app).add(new ApplyDestroyPolicyAspect());
