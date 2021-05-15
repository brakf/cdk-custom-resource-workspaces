import {
    CloudFormationCustomResourceCreateEvent,

    Callback,
    Context,
    CloudFormationCustomResourceEventCommon,
    CloudFormationCustomResourceEvent,
    CloudFormationCustomResourceResponse,
    CloudFormationCustomResourceSuccessResponse,
    CloudFormationCustomResourceFailedResponse
} from "aws-lambda";

import * as trc_ws_ops from "./trc-training-workspace-operations";

import { GetParameterCommand, Parameter, SSMClient } from "@aws-sdk/client-ssm";

import { DescribeDirectoriesCommand, DirectoryServiceClient } from "@aws-sdk/client-directory-service";
// import { Aws } from "@aws-cdk/core";

exports.handler = async (event: CloudFormationCustomResourceEvent, context: Context, callback: Callback): Promise<CloudFormationCustomResourceResponse> => {

    console.log(JSON.stringify(event));




    // const usernames = trc_ws_ops.get_user_names(Number.parseInt(process.env.userAmount as string));

    var directoryId: string;
    var adminUser: string;
    var adminPasswordParameterName: string;
    var baseDN: string;
    var email: string;
    var domain: string;
    var password: string;
    var username: string;



    try {
        directoryId = event.ResourceProperties["directoryId"];
        adminPasswordParameterName = event.ResourceProperties["adminPasswordParameter"];
        adminUser = event.ResourceProperties["adminUser"];
        baseDN = event.ResourceProperties["baseDN"];
        email = event.ResourceProperties["email"];
        domain = event.ResourceProperties["domain"];
        password = event.ResourceProperties["password"];
        username = event.ResourceProperties["username"];

    } catch (error) {
        var returnData: CloudFormationCustomResourceResponse = {
            Status: "FAILED",
            Reason: "Not all Parameters Maintained",
            LogicalResourceId: event.LogicalResourceId,
            PhysicalResourceId: "",
            RequestId: event.RequestId,
            StackId: event.StackId
        };

        console.log(JSON.stringify(returnData));
        return returnData;
    }

    //get endpoint Url

    console.log("getting endpoint url");
    // const dir = event.ResourceProperties["directoryId"] as string;
    console.log("directory:");
    console.log(directoryId);
    const dsClient = new DirectoryServiceClient({
        maxAttempts: 10 //to get hold of timeout errors
    });

    const getEndpointUrlCommand = new DescribeDirectoriesCommand({
        DirectoryIds: [directoryId]
    });

    var endpoint: Array<string> | undefined;
    try {

        // console.log("start api2");
        const getEndpointUrlResult = await dsClient.send(getEndpointUrlCommand).catch(error => {
            console.log("error occurred during api call");
            throw error;
        });
        // console.log("end api");
        console.log(getEndpointUrlResult);

        const directoryDescription = getEndpointUrlResult.DirectoryDescriptions;
        if (directoryDescription !== undefined) {
            const directory = directoryDescription[0];
            if (directory !== undefined) {
                endpoint = directory.DnsIpAddrs;

            }

        }


        if (endpoint === undefined || endpoint.length === 0) {

            var returnObject: CloudFormationCustomResourceResponse = {
                Status: "FAILED",
                Reason: "Endpoint not found",
                LogicalResourceId: event.LogicalResourceId,
                PhysicalResourceId: directoryId + "+user-" + username,
                RequestId: event.RequestId,
                StackId: event.StackId
            }
            console.log(returnObject);
            return returnObject
        }

    } catch (error) {

        console.log("error");
        var returnObject: CloudFormationCustomResourceResponse = {
            Status: "FAILED",
            Reason: JSON.stringify(error),
            LogicalResourceId: event.LogicalResourceId,
            PhysicalResourceId: directoryId + "+user-" + username,
            RequestId: event.RequestId,
            StackId: event.StackId
        }
        console.log(returnObject);
        return returnObject
    }

    const endpointUrl = endpoint[0];
    console.log("endpoint url: " + endpointUrl);


    //get password from SSM Parameter Store
    console.log("get admin password");
    const ssmClient = new SSMClient({
        maxAttempts: 10 //to get hold of timeout errors
    });

    const getParameterCommand = new GetParameterCommand({
        Name: adminPasswordParameterName
    })
    var adminPasswordParameter: Parameter | undefined;

    await ssmClient.send(getParameterCommand)
        .then(value => {
            adminPasswordParameter = value.Parameter;
        })

        .catch(error => {
            console.log("error fetching password");
            var returnObject: CloudFormationCustomResourceResponse = {
                Status: "FAILED",
                Reason: error,
                LogicalResourceId: event.LogicalResourceId,
                PhysicalResourceId: directoryId + "+user-" + username,
                RequestId: event.RequestId,
                StackId: event.StackId
            }
            console.log(returnObject);
            return returnObject;
        });

    if (adminPasswordParameter?.Value === undefined) {
        var returnObject: CloudFormationCustomResourceResponse = {
            Status: "FAILED",
            Reason: "AdminPassword not found",
            LogicalResourceId: event.LogicalResourceId,
            PhysicalResourceId: directoryId + "+user-" + username,
            RequestId: event.RequestId,
            StackId: event.StackId
        }
        console.log(returnObject);
        return returnObject;
    }

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

    console.log(workspaceProps);



    switch (event.RequestType) {
        case "Create":

            console.log("create user");
            return await trc_ws_ops.create_user(workspaceProps,
                {
                    username: username,
                    password: password,
                    email: email
                })
                .then(() => {
                    var returnData: CloudFormationCustomResourceSuccessResponse =
                    {
                        Status: "SUCCESS",
                        Reason: "",
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "+user-" + username,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };
                    console.log(JSON.stringify(returnData));
                    return returnData;
                })
                .catch(error => {
                    var returnData: CloudFormationCustomResourceFailedResponse =
                    {
                        Status: "FAILED",
                        Reason: JSON.stringify(error),
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "+user-" + username,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };

                    console.log(JSON.stringify(returnData));
                    return returnData;
                });

        case "Update":


            //
            var returnDataDelete: CloudFormationCustomResourceSuccessResponse =
            {
                Status: "SUCCESS",
                Reason: "No update took place (to be implemented)",
                LogicalResourceId: event.LogicalResourceId,
                PhysicalResourceId: directoryId + "+user-" + username,
                RequestId: event.RequestId,
                StackId: event.StackId
            };
            console.log(JSON.stringify(returnDataDelete));
            return returnDataDelete;

            break;

        case "Delete":
            //event.LogicalResourceId

            //for now omitted. normally, user would automatically be deleted when directory gets deleted

            var returnDataDelete: CloudFormationCustomResourceSuccessResponse =
            {
                Status: "SUCCESS",
                Reason: "No deletion took place (by design)",
                LogicalResourceId: event.LogicalResourceId,
                PhysicalResourceId: directoryId + "+user-" + username,
                RequestId: event.RequestId,
                StackId: event.StackId
            };
            console.log(JSON.stringify(returnDataDelete));
            return returnDataDelete;






            break;

    }


}