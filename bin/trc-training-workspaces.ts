#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { TrcTrainingWorkspacesStack } from '../lib/trc-training-workspaces-stack';

require('dotenv').config();

const app = new cdk.App();
new TrcTrainingWorkspacesStack(app, 'TrcTrainingWrkspcs', {
    env: {
        account: process.env.AWS_ACCOUNT,
        region: process.env.AWS_REGION
    },
    // vpc: process.env.AWS_VPC_ID as string,
    userAmount: Number.parseInt(process.env.AWS_USER_AMOUNT as string),
    bundleId: process.env.AWS_BUNDLEID as string
});
