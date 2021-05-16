import * as cdk from '@aws-cdk/core';

import { CfnSimpleAD } from "@aws-cdk/aws-directoryservice";

import { StringParameter } from "@aws-cdk/aws-ssm";
import { ISubnet, IVpc, Vpc } from "@aws-cdk/aws-ec2";


import { DirectoryRegistration, LDAPUser, LDAPUserProvider, Workspace, WorkspaceProvider } from "./trc-training-workspaces-custom-ressources";
import { CfnParameter } from '@aws-cdk/core';
interface WorkspacesSetupProps extends cdk.StackProps {
  adminUser: string,
  adminPasswordAD: string,
  vpc: IVpc,
  subnets: ISubnet[],
  userAmount: number,
  bundleId: string,
  domain: string,
  baseDN: string,
  defaultEmail: string
}

const test = true;

interface TrcTrainingWorkspacesStackProps extends cdk.StackProps {
  userAmount: number,
  bundleId: string
}

export class TrcTrainingWorkspacesStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: TrcTrainingWorkspacesStackProps) {
    super(scope, id, props);


    const adminPasswordInput = new CfnParameter(this, "adminPasswordInput", {
      default: "Admin123!Pass",
      // allowedPattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})",
      description: "Password of AD-User 'Administrator'",
      minLength: 8
    });

    // const vpcIdInput = new CfnParameter(this, "vpcId", {
    //   description: "ID of provisioned VPC",
    //   constraintDescription: "Requires private subnet with NAT Gateway",

    // });

    const bundeIdInput = new CfnParameter(this, "bundeIdInput", {
      default: props.bundleId, //"wsb-5y88rt6x3",
      description: "Workspace BundleId",
    });
    const domainInput = new CfnParameter(this, "domainInput", {
      default: "dataanalytics.training.tecracer.de",
      description: "Domain",
    });
    const baseDNInput = new CfnParameter(this, "baseDNInput", {
      default: "CN=Users, DC=dataanalytics,DC=training,DC=tecracer,DC=de",
      description: "Base DN of Active Directory. Based on Domain Name",
    });
    const defaultEmailAddressInput = new CfnParameter(this, "defaultEmailAddressInput", {
      default: "noreply@tecracer.de",
      description: "Email Adresses for AD users",
    });

    const vpc = new Vpc(this, "vpc", {
      maxAzs: 2

    });


    const workspacesProps: WorkspacesSetupProps = {
      adminUser: "Administrator",
      adminPasswordAD: adminPasswordInput.value.toString(),
      vpc: vpc,
      subnets: vpc.privateSubnets,
      userAmount: props.userAmount,
      bundleId: bundeIdInput.value.toString(), //"wsb-5y88rt6x3",
      domain: domainInput.value.toString(),
      baseDN: baseDNInput.value.toString(),
      defaultEmail: defaultEmailAddressInput.value.toString(),
      // env: {
      //   account: props?.env?.account,
      //   region: props?.env?.region
      // }

    }
    // The code that defines your stack goes here
    const workspacesSetup = new Setup(this, "Setup", workspacesProps);
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
    directoryRegistration.Register(simpleAD, props.vpc);

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
      }, props.vpc);



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



