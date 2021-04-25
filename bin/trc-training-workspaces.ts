#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { TrcTrainingWorkspacesStack } from '../lib/trc-training-workspaces-stack';

const app = new cdk.App();
new TrcTrainingWorkspacesStack(app, 'TrcTrainingWrkspcs3');
