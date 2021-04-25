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

    var directoryId: string; //props.provider.simpleAD.ref,
    var bundleId: string; //props.bundleId,
    var userName: string; // props.username,
    var runningMode: "AUTO_STOP" | "ALWAYS_ON"; // props.runningMode



    try {

        directoryId = event.ResourceProperties["directoryId"];

        bundleId = event.ResourceProperties["bundleId"];
        userName = event.ResourceProperties["userName"];
        runningMode = event.ResourceProperties["runningMode"];

    } catch (error) {
        var returndata: CloudFormationCustomResourceResponse = {
            Status: "FAILED",
            Reason: "Not all Parameters Maintained",
            LogicalResourceId: event.LogicalResourceId,
            PhysicalResourceId: "workspace",
            RequestId: event.RequestId,
            StackId: event.StackId
        };

        console.log(JSON.stringify(returndata));
        return returndata;
    }


    var workspaceProps: trc_ws_ops.workspace_props = {
        adminUser: "",
        adminPassword: "",
        baseDN: "",
        defaultEmail: "",
        bundle: bundleId,
        directory: directoryId,
        domain: "",
        endpointUrl: "",
        runningMode: runningMode



    };

    console.log(workspaceProps);



    switch (event.RequestType) {
        case "Create":

            console.log("create workspace");
            return await trc_ws_ops.create_workspace(workspaceProps, userName)
                .then((workspaceId) => {
                    var returndata: CloudFormationCustomResourceSuccessResponse =
                    {
                        Status: "SUCCESS",
                        Reason: "",
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: workspaceId,
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
                        PhysicalResourceId: "failedToCreate",
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };

                    console.log(JSON.stringify(returndata));
                    return returndata;
                });

        case "Update":

            var returndataupdate: CloudFormationCustomResourceSuccessResponse =
            {
                Status: "SUCCESS",
                Reason: "No update function defined",
                LogicalResourceId: event.LogicalResourceId,
                PhysicalResourceId: event.PhysicalResourceId,
                RequestId: event.RequestId,
                StackId: event.StackId
            };
            console.log(JSON.stringify(returndataupdate));
            return returndataupdate;
            break;

        case "Delete":




            return await trc_ws_ops.delete_workspace(event.PhysicalResourceId)
                .then(() => {
                    var returndata: CloudFormationCustomResourceSuccessResponse =
                    {
                        Status: "SUCCESS",
                        Reason: "",
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: event.PhysicalResourceId,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };
                    console.log(JSON.stringify(returndata));
                    return returndata;
                })

                .catch(err => {
                    var returndata: CloudFormationCustomResourceFailedResponse =
                    {
                        Status: "FAILED",
                        Reason: JSON.stringify(err),
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: event.PhysicalResourceId,
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };

                    console.log(JSON.stringify(returndata));
                    return returndata;
                });








            break;


    }


}