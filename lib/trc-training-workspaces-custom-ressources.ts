import * as cdk from '@aws-cdk/core';

import { CfnSimpleAD } from "@aws-cdk/aws-directoryservice";
import { Code, Function, Runtime } from "@aws-cdk/aws-lambda";
import { Provider } from "@aws-cdk/custom-resources";

import { StringParameter } from "@aws-cdk/aws-ssm";
import { IVpc, Vpc } from "@aws-cdk/aws-ec2";

import { Effect, PolicyStatement } from "@aws-cdk/aws-iam";
// import { workspace_settings } from '../lambda/workspace-ressouce-handler/node_modules/trc-training-workspace-operations/trc-training-workspace-operations';
import { CustomResource, Duration } from '@aws-cdk/core';

interface WorkspaceProviderProps {
    simpleAD: CfnSimpleAD,
    // username: string
}

export class WorkspaceProvider extends cdk.Construct {
    provider: Provider;
    serviceToken: string;
    simpleAD: CfnSimpleAD;

    constructor(scope: cdk.Construct, id: string, props: WorkspaceProviderProps) {
        super(scope, id);
        this.provider = this.CustomRessourceWorkspace(props.simpleAD)
        this.simpleAD = props.simpleAD;
        this.serviceToken = this.provider.serviceToken;
    }

    CustomRessourceWorkspace(simpleAD: CfnSimpleAD): Provider {
        const customRessourceHandler = new Function(this, "workspaceCreateWorkspace", {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code: Code.fromAsset('lambda/workspace-create-workspace'),
            logRetention: 3,
        });

        customRessourceHandler.node.addDependency(simpleAD);

        customRessourceHandler.role?.addToPrincipalPolicy(new PolicyStatement({
            actions: [
                "workspaces:*",
            ],
            effect: Effect.ALLOW,
            resources: ['*'],
        }));

        // const prefix = "workspaceCreateLdapUser";
        // const SG = new SecurityGroup(this, prefix + "SG", {
        //   vpc: vpc,
        //   allowAllOutbound: true,

        // });
        // SG.addIngressRule

        const CustomRessourceProvider = new Provider(this, "provider", {
            onEventHandler: customRessourceHandler,


        });



        return CustomRessourceProvider;


    }



}
interface WorkspaceProps {
    provider: WorkspaceProvider,
    // adminUser: string,
    // adminPasswordParameter: StringParameter,
    user: LDAPUser,
    bundleId: string,
    runningMode?: "AUTO_STOP" | "ALWAYS_ON"
}

export class Workspace extends cdk.Construct {
    Ressource: CustomResource;

    constructor(scope: cdk.Construct, id: string, props: WorkspaceProps) {
        super(scope, id);

        if (props.runningMode === undefined) {
            props.runningMode = "AUTO_STOP";
        }



        this.Ressource = new CustomResource(this, id + props.user.username, {
            serviceToken: props.provider.serviceToken,
            properties: {
                directoryId: props.provider.simpleAD.ref,
                bundleId: props.bundleId,
                userName: props.user.username,
                runningMode: props.runningMode
            }
        });

        this.Ressource.node.addDependency(props.user)


    }

}



interface LDAPUserProviderProps {
    simpleAD: CfnSimpleAD,
    adminUser: string;
    adminPasswordParameter: StringParameter,
    vpc: IVpc,
    baseDN: string;
    domain: string;
}

export class LDAPUserProvider extends cdk.Construct {
    provider: Provider;
    serviceToken: string;
    simpleAD: CfnSimpleAD;
    baseDN: string;
    domain: string;
    adminPasswordParameter: StringParameter;
    adminUser: string;



    constructor(scope: cdk.Construct, id: string, props: LDAPUserProviderProps) {
        super(scope, id);

        //create Handler Lamdba Function
        const customRessourceHandler = new Function(this, "workspaceCreateLdapUser", {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code: Code.fromAsset('lambda/workspace-create-ldap-user'),
            logRetention: 3,
            timeout: Duration.minutes(2),
            vpc: props.vpc,
            vpcSubnets:
            {
                subnets: props.vpc.privateSubnets
            }

        });

        //provide proper authorizations to Lamdba Function
        props.adminPasswordParameter.grantRead(customRessourceHandler);
        customRessourceHandler.role?.addToPrincipalPolicy(new PolicyStatement({
            actions: [
                "ds:*",
            ],
            effect: Effect.ALLOW,
            resources: ['*'],
        }));

        //add dependencies to other ressources that have to exists for the lamdba function to work properly
        //deployment of the custom ressource will wait for those to be created.
        customRessourceHandler.node.addDependency(props.vpc); //required to make sure NAT gateways do not get deleted before lamdba does.

        // create actual provider
        this.provider = new Provider(this, "provider", {
            onEventHandler: customRessourceHandler,
            vpc: props.vpc,
        });



        //store properties
        this.simpleAD = props.simpleAD;
        this.baseDN = props.baseDN;
        this.domain = props.domain;
        this.serviceToken = this.provider.serviceToken;
        this.adminPasswordParameter = props.adminPasswordParameter
        this.adminUser = props.adminUser
    }

}

interface LDAPUserProps {
    provider: LDAPUserProvider,
    // adminUser: string,
    // adminPasswordParameter: StringParameter,
    username: string,
    password: string,
    email: string

}
export class LDAPUser extends cdk.Construct {
    Ressource: CustomResource;
    username: string;
    email: string;
    password: string;

    constructor(scope: cdk.Construct, id: string, props: LDAPUserProps) {
        super(scope, id);

        this.Ressource = new CustomResource(this, "LDAPUser-" + props.username, {
            serviceToken: props.provider.serviceToken,
            properties: {
                directoryId: props.provider.simpleAD.ref,
                "adminUser": props.provider.adminUser,
                "adminPasswordParameter": props.provider.adminPasswordParameter.parameterName,
                "baseDN": props.provider.baseDN,//"CN=Users, DC=dataanalytics,DC=training,DC=tecracer,DC=de",
                "email": props.email,
                "domain": props.provider.domain, //"dataanalytics.training.tecracer.de",
                "username": props.username,
                "password": props.password

            }
        });

        //moved here from provider to allow parallel provisioning of provider and AD
        this.Ressource.node.addDependency(props.provider.simpleAD);
        this.Ressource.node.addDependency(props.provider.adminPasswordParameter);


        this.username = props.username;
        this.password = props.password;
        this.email = props.email;

    }

}

export class DirectoryRegistration extends cdk.Construct {
    provider: Provider;
    workspaceRegistration: CustomResource;

    constructor(scope: cdk.Construct, id: string) {
        super(scope, id);
        this.provider = this.CustomRessourceDirectoryRegistration();
        //
        // this.Register(props.simpleAD);

    }
    CustomRessourceDirectoryRegistration(): Provider {
        //define setup lambda function
        const customRessourceHandler = new Function(this, "workspaceRegistrationHandler", {
            runtime: Runtime.NODEJS_14_X,
            handler: 'index.handler',
            code: Code.fromAsset('lambda/workspace-registration-handler'),
            logRetention: 3,
            timeout: Duration.minutes(2)

        });


        customRessourceHandler.role?.addToPrincipalPolicy(new PolicyStatement({
            actions: [
                "workspaces:*",
                "ds:*",
                "iam:PassRole",
                "iam:GetRole",
                "iam:CreateRole",
                "iam:PutRolePolicy",
                "kms:ListAliases",
                "kms:ListKeys",
                "ec2:CreateVpc",
                "ec2:CreateSubnet",
                "ec2:CreateNetworkInterface",
                "ec2:CreateInternetGateway",
                "ec2:CreateRouteTable",
                "ec2:CreateRoute",
                "ec2:CreateTags",
                "ec2:CreateSecurityGroup",
                "ec2:DescribeInternetGateways",
                "ec2:DescribeSecurityGroups",
                "ec2:DescribeRouteTables",
                "ec2:DescribeVpcs",
                "ec2:DescribeSubnets",
                "ec2:DescribeNetworkInterfaces",
                "ec2:DescribeAvailabilityZones",
                "ec2:AttachInternetGateway",
                "ec2:AssociateRouteTable",
                "ec2:AuthorizeSecurityGroupEgress",
                "ec2:AuthorizeSecurityGroupIngress",
                "ec2:DeleteSecurityGroup",
                "ec2:DeleteNetworkInterface",
                "ec2:RevokeSecurityGroupEgress",
                "ec2:RevokeSecurityGroupIngress",
                "workdocs:RegisterDirectory",
                "workdocs:DeregisterDirectory",
                "workdocs:AddUserToGroup"
            ],
            effect: Effect.ALLOW,
            resources: ['*'],
        }));


        const CustomRessourceProvider = new Provider(this, "workspaceRegistrationHandler" + "-provider", {
            onEventHandler: customRessourceHandler,
            // vpcSubnets: {
            //   subnets: props.subnets
            // },
        });

        return CustomRessourceProvider;

    }

    Register(simpleAD: CfnSimpleAD) {
        this.workspaceRegistration = new CustomResource(this, "WorkspaceSetup", {
            serviceToken: this.provider.serviceToken,
            properties: {
                directory: simpleAD.ref
            }
        });

        this.workspaceRegistration.node.addDependency(simpleAD);
    }

}