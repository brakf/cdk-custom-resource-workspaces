import * as cdk from '@aws-cdk/core';

import { CfnSimpleAD } from "@aws-cdk/aws-directoryservice";

import { StringParameter } from "@aws-cdk/aws-ssm";
import { ISubnet, Vpc } from "@aws-cdk/aws-ec2";


import { DirectoryRegistration, LDAPUser, LDAPUserProvider, Workspace, WorkspaceProvider } from "./trc-training-workspaces-custom-ressources";
interface WorkspacesSetupProps extends cdk.StackProps {
  adminUser: string,
  adminPasswordAD: string,
  vpc: Vpc,
  subnets: ISubnet[],
  userAmount: number,
  bundleId: string,
  domain: string,
  baseDN: string,
  defaultEmail: string
}

const test = true;

export class TrcTrainingWorkspacesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);


    var
      testEnvironment = new TestEnvironment(this, "test");



    const workspacesProps: WorkspacesSetupProps = {
      adminUser: "Administrator",
      adminPasswordAD: "Password123!",
      vpc: testEnvironment.vpc,
      // testEnvironment.vpc.vpcId,
      //   Vpc.fromLookup(this, "vpc", {
      //   vpcId: props.vpcID,

      // })
      subnets: testEnvironment.vpc.privateSubnets,
      //   .map(subnet => {
      //   return subnet.subnetId
      // }),
      userAmount: 2,
      bundleId: "wsb-8vbljg4r6", //"wsb-5y88rt6x3",
      domain: "dataanalytics.training.tecracer.de",
      baseDN: "CN=Users, DC=dataanalytics,DC=training,DC=tecracer,DC=de",
      defaultEmail: "noreply@tecracer.de"

    }
    // The code that defines your stack goes here
    const workspacesSetup = new Setup(this, "Setup", workspacesProps);






  }
}
class TestEnvironment extends cdk.Construct {

  vpc: Vpc;

  constructor(scope: cdk.Construct, id: string) {

    super(scope, id);



    this.vpc = new Vpc(this, "test vpc", {

    });






  }

}

class Setup extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: WorkspacesSetupProps) {
    super(scope, id);

    const simpleAD = new CfnSimpleAD(this, "SimpleAD", {
      name: props.domain,
      password: props.adminPasswordAD,
      size: "Small",
      vpcSettings: {
        vpcId: props.vpc.vpcId,
        subnetIds: props.subnets.map(subnet => {
          return subnet.subnetId
        }),
      },

    });



    //save password in SSM Parameter Store
    const
      adminPasswordParameter = new StringParameter(this, "password", {
        stringValue: props.adminPasswordAD
      })

    const directoryRegistration = new DirectoryRegistration(this, "DirectoryRegistration");
    directoryRegistration.Register(simpleAD);

    const lDAPUserProvider = new LDAPUserProvider(this, "LDAPUserProvider", {
      adminUser: props.adminUser,
      adminPasswordParameter: adminPasswordParameter,
      simpleAD: simpleAD,
      vpc: props.vpc,
      baseDN: props.baseDN,
      domain: props.domain
    });

    const workspaceProvider = new WorkspaceProvider(this, "WorkspaceProvider", {
      simpleAD: simpleAD
    })


    const users: string[] = this.get_user_names(props.userAmount);

    users.forEach(user => {
      const ldapUser = new LDAPUser(this, "User_" + user, {
        username: user,
        password: user + "!",
        email: "noreply@tecracer.de",
        provider: lDAPUserProvider
      });

      const workspace = new Workspace(this, "Workspace_" + user, {
        provider: workspaceProvider,
        user: ldapUser,
        bundleId: props.bundleId
      });
    });








    // const ldapUser2 = new CustomResource(this, "LDAPUser2", {
    //   serviceToken: LDAPUserProvider.serviceToken,
    //   properties: {
    //     directoryId: simpleAD.ref,
    //     "adminUser": "Administrator",
    //     "adminPasswordParameter": adminPasswordParameter.parameterName,
    //     "baseDN": "CN=Users, DC=dataanalytics,DC=training,DC=tecracer,DC=de",
    //     "defaultEmail": "noreply@tecracer.de",
    //     "domain": "dataanalytics.training.tecracer.de",
    //     "username": "Usder12sd55",
    //     "password": "User12345!"

    //   }
    // });








  }

  get_user_names(userAmount: number): Array<string> {

    var users: Array<string> = [];

    for (let index = 0; index < userAmount; index++) {

      users.push("training" + (index + 1).toString().padStart(2, "0"));

    }

    return users;
  }


}



