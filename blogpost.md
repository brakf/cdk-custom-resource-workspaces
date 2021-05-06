# Implementing and deploying Custom Resources using CDK

I am a big fan of AWS's Cloud Development Kit (CDK) as it allows me to use Typescript (or another prefered programming language) to set up any infrastructure in AWS as code. However, not all types of resources are creatable with CDK by default. I recently learned this fact in a small project I was working on. However, instead of being frustrated about it, it gave me the chance to learn about an awesome feature of CDK (or better said CloudFormation on which CDK is built). I am refering to *CustomResources*.

## Task
The initial task was to set up AWS workspaces for a training lab environment. The training participants should be able to log into to their virtual desktop environment via the web browser and from there connect to other AWS ressources. This was necessary because one customer's security policy didn't allow direct RDP or SSH traffic.
Setting this up via the AWS Console didn't take extremly long and worked perfectly fine. However, I needed a solution that would run automatically and would provide a clean setup for each new training. The requirement was to have a solution where the exact number of created workspaces would be configurable and no additional manual effort would be needed after triggering the setup.

## Problem
On my quest to find a proper solution for this task, I quickly realized a few problems that were not solveable with CDK by default:
1. Workspaces require a connection to an Active Directory. Luckily I was working in eu-west-1 were SimpleAD is enabled. However, CDK does not yet have the required API to "register" the directory for use with AWS Workspaces.
2. There is no CloudFormation/CDK Construct for the individual Workspaces. One reason for this is that every workspaces is bound to a user in the provided directory.
3. AD users cannot be created via CloudFormation/CDK. AWS does not managed those resources. AWS manages the AD, but not what is inside.

## Solution
Initially, I built a simple node.js script that I ran on my local machine. It required that a Simple AD would be provisioned already and that its API-Endpoint (using the LDAP protocal) would be reachable from my machine. For the later I used a Network Load Balancer.

The script did the following:
- Call the *RegisterWorkspaceDirectory* API via the workspaces SDK. This prepared the directory for use with Workspaces. Additionally I used the *ModifyWorkspaceAccessProperties* API to enable web access to workspaces.
- Create a list of users and passwords based on the required training participants named training01, training02, etc.
- Loop the list and do the following for every user in the list:
	- Create the user in the Simple AD using the LDAP protocol. I found a pretty handy npm package called *ldapts* to achive this. There is no AWS API for user creation in Simple AD.
	- Set the user's password using the *ResetUserPassword* API of directory services SDK. (I do not understand why this one exists while there is no user creation API, however it is easier to use than plain LDAP).
	- Create a workspace for the user using the *CreateWorkspaces* API.
	
So far so good. This works fine. However, it is not integrated into CDK and requires network connectivity to the LDAP API endpoint.

Therefore I started learning about CDK *Custom Ressources*. Custom Ressources provide a flexible interface to define and managed entities that are not part of CDK's or even AWS's default set of resources. With custom ressources you can define any type of object you like. Creation, Update and Deletion are handled within a Lamdba function that is called during deployment of your stack. Of course you have to follow some guidelines on how to handle those "resource lifecycle events", but they are fairly well described in the official documentation and are easy to learn if you are familiar with CDK and Lambda. If you use Python, AWS even provides some helper libraries. (Didn't help me...I used Typescript).

For matter of simplicity, I will demonstrate only a small part of my final setup. However, the full solution can be found [here](https://github.com/brakf/cdk-custom-ressource-workspaces).

## Technical Deep Dive
At its core, a custom Resource is itself a CDK construct that takes in two types of parameters. First, the properties of the resource (e.g. username, password, ID of the directory, etc.). Second, it requires a reference to a *Provider* (or better said its *serviceToken*).

```typescript
  new CustomResource(this, "ResourceName", {
            properties: {
                directoryId: simpleAD.ref,
                userName: "user",
                ...
            },
            serviceToken: provider.serviceToken
  }
```

All logic of how to create and maintain the resource is defined with the provider function. As I am a big fan of useful encapsulation, I placed all required objects into a custom class that I initialize once within my code and then refer to later (e.g. to get the serviceToken).

Lets analyse it.


```typescript
interface LDAPUserProviderProps {
    vpc: Vpc,
    simpleAD: CfnSimpleAD,
    adminUser: string;
    adminPasswordParameter: StringParameter,
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

```
Above are simply the parameter definitions and the properties of the class. The properties store some general data later used for creation of the resource as well as a reference to the actual Provider object.
```typescript
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
```
This lambda function "does all the magic". We will later dive into it. You can see that it is deployed within a VPC. This is required as the API endpoints of the directory are only accessible within this VPC. As it additionally needs to reach the public endpoints of the AWS APIs, it has to be placed within a private subnets with a route to a NAT gateway.

The rest of the class is again straight forward. The Lamdba function requires some additional authorizations for the AWS APIs. Also it is always important to be aware of what other resources need to exist for proper deployment of the Provider and the CustomResource. For Provider deployment, the VPC needs to exists. For the deployment of the new AD User, the directory itself needs to exists. The dependency to the directory is attached to the CustomResource directly as we will see later. 
```typescript
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
        customRessourceHandler.node.addDependency(props.vpc); // dependency to VPC required to make sure NAT gateways do not get deleted before lamdba does.

        // create actual provider using the Lamdba function and the vpc
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
```

Next, lets look at the Lamdba function. Its basic structure is defined by the *RequestType* of the current request. Based on this property, the respective activity is performed.


```typescript
exports.handler = async (event: CloudFormationCustomResourceEvent, context: Context, callback: Callback): Promise<CloudFormationCustomResourceResponse> => {

    //do some pre execution preperation, e.g.:
    //get LDAP endpoint URL via DescribeDirectories API
    //get Admin Password from SSM Parameter Store
    [...]

    //then execute task based on request type
     switch (event.RequestType) {
        case "Create":

            try {
                    [...] //magic to create the ressource
                    return {
                        Status: "SUCCESS",
                        Reason: "",
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "+user-" + username,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };
                    //PhysicalRessourceID needs to be able to uniquely identify the object later on
            }
            catch(error) {
                return {
                        Status: "FAILED",
                        Reason: JSON.stringify(error),
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "+user-" + username,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };
            }
                    
            break;

        case "Update":

            try {
                    [...] //magic to update the ressource based properties in event and PhysicalRessourceID
                    return {
                        Status: "SUCCESS",
                        Reason: "",
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "+user-" + username,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };
            }
            catch(error) {
                return {
                        Status: "FAILED",
                        Reason: JSON.stringify(error),
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "+user-" + username,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };
            }

            break;

        case "Delete":

            try {
                    [...] //magic to delete the ressource based on the PhysicalRessourceID
                    return {
                        Status: "SUCCESS",
                        Reason: "",
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "+user-" + username,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };
            }
            catch(error) {
                return {
                        Status: "FAILED",
                        Reason: JSON.stringify(error),
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "+user-" + username,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };
            }

            break;
    }


}
```

There are a few important things to note about those request types:
- The PhysicalRessourceId that is returned after creation is supposed to be a unique identifier for the object. It is created by the lamdba function when initialy creating the object. It is later provided to the function during update or deletion.
- Implement proper error handling to avoid endless loops
- During deployment the function will be called multiple times if it fails. Keep that it mind 


To come back to the original example of user creation in LDAP, this is the content of my *Creation* event handler. The *trc_ws_ops.create_user* function is defined in a seperate module and calls the LDAP API with the provided parameters using the connection details specified in *workspaceProps*. 

```typescript

    var workspaceProps: trc_ws_ops.workspace_props = {
        adminUser: "Administrator",
        adminPassword: adminPasswordParameter.Value,
        baseDN: baseDN,
        defaultEmail: email,
        bundle: "", //not required
        directory: directoryId,
        domain: domain,
        endpointUrl: endpointUrl
    };
  
    return await trc_ws_ops.create_user(workspaceProps,
        {
            username: username,
            password: password,
            email: email
        })
        .then(() => {
            var returndata: CloudFormationCustomResourceSuccessResponse =
            {
                Status: "SUCCESS",
                Reason: "",
                LogicalResourceId: event.LogicalResourceId,
                PhysicalResourceId: directoryId + "+user-" + username,
                RequestId: event.RequestId,
                StackId: event.StackId
            };
            console.log(JSON.stringify(returndata));
            return returndata;
        })
        .catch(error => {
            var returndata: CloudFormationCustomResourceFailedResponse =
            {
                Status: "FAILED",
                Reason: JSON.stringify(error),
                LogicalResourceId: event.LogicalResourceId,
                PhysicalResourceId: directoryId + "+user-" + username,
                RequestId: event.RequestId,
                StackId: event.StackId
            };

            console.log(JSON.stringify(returndata));
            return returndata;
        });
```

Let us look into creating users within a provided Active Directory (here using SimpleAD). My goal was to have CKD Construct as below that I could simply loop for all new users I required. 
```typescript
    const ldapUser = new LDAPUser(this, "User_" + user, {
        username: user,
        password: user + "!",
        email: "noreply@tecracer.de",
        provider: lDAPUserProvider
      });
```
The Construct *LDAPUser* is merely an abstraction for the following 


```typescript

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
                "baseDN": props.provider.baseDN,
                "email": props.email,
                "domain": props.provider.domain,
                "username": props.username,
                "password": props.password

            }
        });

        //ensures that the AD exists before the user creation is started
        this.Ressource.node.addDependency(props.provider.simpleAD);
        this.Ressource.node.addDependency(props.provider.adminPasswordParameter);


        this.username = props.username;
        this.password = props.password;
        this.email = props.email;

    }

}

```
After having defined, implemented and tested the Provider Functions, using it is fairly simple as already demonstrated in the beginning.

First, the Provider is initialized. For this we create an instance of our previously defined *LDAPUserProvider* class. As a reminder: it contains the actual provider and its serviceToken as a property. 

```typescript

    const lDAPUserProvider = new LDAPUserProvider(this, "LDAPUserProvider", {
      adminUser: props.adminUser,
      adminPasswordParameter: adminPasswordParameter,
      simpleAD: simpleAD,
      vpc: props.vpc,
      baseDN: props.baseDN,
      domain: props.domain
    });
```
The creation of the *CustomResource* can further be encapsulated in a *LDAPUser* class to simplify usage, which concludes this task. Note that the *provider* properties refers to the *LDAPUserProvider*.
```typescript
    const ldapUser = new LDAPUser(this, "User_" + user, {
        username: user,
        password: user + "!",
        email: "noreply@tecracer.de",
        provider: lDAPUserProvider
      });
```

## Pain Points and Learnings

Having completed this task, I feel like I will be able to build new Custom Resources fairly quick. However, getting to this point was accompanied by a steep learning curve and a lot of trail and error. Especially debugging the provider function took a lot of time and effort.

My recommendation is to follow a layered approach when developing:
1. Create a Creation, Update and Deletion Logic in a seperate module that you can test locally
2. Create the provider function, but test it first outside of CDK
3. Only then integrate it into CDK.

Another thing that took some time to realize and debug were dependency issues to other resources. One example was an instance, when the NAT Gateways of the VPC were deleted before the LDAP Users could be deleted. However, those are required for some API calls made by the Lambda function. This led to timeout issues of the API calls, resulting in endless retrys of the delete event until the Deployment timed out (leaving the stack in an inconsitent state).