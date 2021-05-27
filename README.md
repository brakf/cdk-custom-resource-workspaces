# Training Workspace Creation

This CDK Project allows automatic creation of all resources required for a training lab environment using AWS workspaces.

## Prerequisite:
- An existing VPC with private subnets needs to exist. Those private subnets require access to AWS API Endpoints (e.g. via NAT Gateway)
- NPM and CDK need to be installed on your local machine
- obtain AWS authorizations via CLI (e.g. via awsume)

## How to deploy
1. Copy the *example.env* file to *.env* and modify the required parameters
```
AWS_USER_AMOUNT=4
AWS_BUNDLEID=wsb-8vbljg4r6
```

AWS_USER_AMOUNT refers to the amount of users to create. They will be called training01 - training 0n (password for each is username + !).

AWS_BUNDLEID refers to a AWS Workspaces Bundle that needs to be provided. Check the AWS documentation to find out more.



2. install dependencies and create transpile ts to js files

    I provided a script that performs those steps on linux.
    It might show tsc errors for some aws-sdk modules. Those can be ignored.
```
chmod a+x prepareRepoForDeployment.sh
./prepareRepoForDeployment.sh
```


3. to deploy run
```
cdk deploy
```
4. approve deployment
```
Do you wish to deploy these changes (y/n)?
```

## Verify Deployment

Deployment will take some time (5 - 10 minutes).
Afterwards you can verify it by checking the following in AWS Console:

1. If Directory Registration was successful

    https://eu-west-1.console.aws.amazon.com/workspaces/home?region=eu-west-1#directories:directories

2. Make sure that web access is possible (expand directory to view )

    **Unfortunately, there is a bug in the Workspaces API. Therefore it is currently required to perform a manual activity after deployment. The bug is already addressed to AWS support.**

    1. Access Settings on Directories Page
    ![Screenshot Bug 1](img/workspace-setting-bug1.PNG)
    2. Open Access Control Options
    ![Screenshot Bug 2](img/workspace-setting-bug2.PNG)
    3. **Uncheck** *Web Access* and Save/Update
    4. **Check** *Web Access* again and Save/Update
    5. Verify that web access is active now on overview page
     ![Screenshot Bug 3](img/workspace-setting-bug3.PNG)
    6. You might need to 


2. Check if Workspaces were created

    https://eu-west-1.console.aws.amazon.com/workspaces/home?region=eu-west-1#listworkspaces

    Workspaces stay in pending state until they are finally accessible.
    Here, you also find the Registration Code, that the users require to log in.
    
    ![workspace-registration-code.PNG](img/workspace-registration-code.PNG)
    

   


    Default Password of the users are username + "!"

    Web Access is possible via the following Link:
    https://clients.amazonworkspaces.com/webclient


## Delete Stack
To delete stack, run 
```
cdk destroy
```

-> Currently I am still facing an error that the VPC that gets created fails to delete... It currently has to be deleted manually after the delete job runs into a timeout. Probably some stupid dependency issue. Will look for a solution ASAP.

## Open Bugs
- Stack Deletion fails due to some dependency of the VPC
- Bugs in AWS API: 
- 1. Web Access is not allowed automatically (described above)
- 2. Workspaces occasionally get launched into a public subnet. There is not explaination but it being a bug in AWS as well.
