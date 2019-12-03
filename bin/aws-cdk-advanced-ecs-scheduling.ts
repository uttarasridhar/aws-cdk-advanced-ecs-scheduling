#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { AwsCdkAdvancedEcsSchedulingStack } from '../lib/aws-cdk-advanced-ecs-scheduling-stack';

const app = new cdk.App();
new AwsCdkAdvancedEcsSchedulingStack(app, 'AwsCdkAdvancedEcsSchedulingStack');
