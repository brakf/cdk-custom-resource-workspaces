import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as TrcTrainingWorkspaces from '../lib/trc-training-workspaces-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new TrcTrainingWorkspaces.TrcTrainingWorkspacesStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
