
## Task
The initial task was to try out workspaces for a training lab environment. The training participants should be able to log into to their virtual desktop environment via the web browser and from there connect to other AWS ressources. This was necessary because one customer's security policy didn't allow direct RDP or SSH traffic.
Setting this up via the AWS Console didn't take long and worked perfectly fine. However, I needed a solution that would run automatically and would provide a clean setup for each new training. The requirement was to have a solution where the exact number of created workspaces would be configurable and no manual effort would be needed after triggering the setup.
As the existing setup for this lab environment is planned for migration from CloudFormation to CDK, I wanted to achive my goal using CDK.

## Problem
On my quest to find a proper solution for this task, I quickly realized a few problems that were not solveable with CDK by default:
1. Workspaces require a connection to a Active Directory. Luckily I was working in eu-west-1 were SimpleAD is enabled. However, CDK does not yet have the required API to "register" the directory for workspaces.
2. There is no CloudFormation/CDK Construct for the individual Workspaces. One reason for this is that every workspaces is bound to a user in the provided directory.
3. AD users cannot be created via CloudFormation/CDK. AWS does not managed those ressources. AWS managed the AD, but not what is inside.


As CDK builds on CloudFormation, the solution should be adaptable to CloudFormation as well.

## Solution
Initially I built a simple nodejs script that I ran on my local machine. It required that a Simple AD would be provisioned already and that its API-Endpoint(LDAP) would be reachable from my machine. The later required the use of a Network Load Balancer.

The script did the following:
- Call the RegisterWorkspaceDirectory API via the workspaces SDK. This would prepare the directory for use with Workspaces. Additionally I used the ModifyWorkspaceAccessProperties API to enable web access to workspaces.
- Create a list of users and passwords based on the required training participants named Training01, Training02, etc.
- Loop the list and do the following for every user in the list
	- Create the user in the Simple AD using the LDAP protocol. I found a pretty handy npm package called ldapts to achive this. There is no AWS API for user creation.
	- Set the user's password using the ResetUserPassword API of directory services SDK (I do not understand why this one exists while there is no user creation API).
	- Create a workspace for the user using the CreateWorkspaces API
	
So far so good. This works fine. However, it is not integrated into CDK.

Therefore I started to try out Custom Ressources. Custom Ressources provide a flexible interface to define and managed entities that are not part of CDKs or even AWS's default set of resources. With custom ressources you can define any type of object you like. Creation, Update and Deletion are handled within a Lamdba function that is called during deployment of your stack. Of course you have to follow some guidelines on how to handle those "resource lifecycle events", but they are fairly well described in the official documentation and are easy to learn.

My goal was to be able to create a new User in the SimpleAD as easy as with below code. And I succeded! 
```typescript
    const ldapUser = new LDAPUser(this, "User_" + user, {
        username: user,
        password: user + "!",
        email: "noreply@tecracer.de",
        provider: lDAPUserProvider
      });
```





	
After having defined, implemented and tested the Provider Functions, using those is fairly simple. As an example the following code creates a user via LDAP.

First, the Provider is initialized. For this we create an instance of our previously defined *LDAPUserProvider* class. As a reminder: it contains the actual provider and its serviceToken as a property. Those are required in the next steps. 

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
Then we create an instance of *CustomResource* and hand it the serviceToken of the Provider as well as all properties that define the resource. The properties defined here describe the object and are provided to the Lambda Handler Function during deployment.

```typescript
    new CustomResource(this, "LDAPUser-" + props.username, {
            serviceToken: lDAPUserProvider.serviceToken,
            properties: {
                "directoryId": props.simpleAD.ref,
                "adminUser": props.adminUser,
                "adminPasswordParameter": props.adminPasswordParameter.parameterName,
                "baseDN": props.baseDN,
                "email": props.email,
                "domain": props.domain,
                "username": props.username,
                "password": props.password
            }
```
To further ease usage of the new CustomResource, it can be wrapped inside another custom class *LDAPUser*. As properties, it only requires user specific details like its name as well as an instance of the *LDAPUserProvider* class created earlier. The later stores all generic information required to create the user (e.g. the ID of the SimpleAD).
```typescript
    const ldapUser = new LDAPUser(this, "User_" + user, {
        username: user,
        password: user + "!",
        email: "noreply@tecracer.de",
        provider: lDAPUserProvider
      });
```





## Pain Points and Learnings


Points to improve:
- Security: 
	Use LDAPS
	Custom Passwords


- watch dependencies
    - example NAT gateways....

