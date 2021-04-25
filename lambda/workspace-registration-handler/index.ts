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

// import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

// import { DescribeDirectoriesCommand, DirectoryServiceClient } from "@aws-sdk/client-directory-service";
// import { Aws } from "@aws-cdk/core";

exports.handler = async (event: CloudFormationCustomResourceEvent, context: Context, callback: Callback): Promise<CloudFormationCustomResourceResponse> => {

    console.log(JSON.stringify(event));



    if (event.ResourceProperties["directory"] === undefined) {




        var returndata: CloudFormationCustomResourceResponse = {
            Status: "FAILED",
            Reason: "Directory ID not provided",
            LogicalResourceId: event.LogicalResourceId,
            PhysicalResourceId: "",
            RequestId: event.RequestId,
            StackId: event.StackId
        };

        console.log(JSON.stringify(returndata));
        return returndata;
    }

    const directoryId = event.ResourceProperties["directory"];




    switch (event.RequestType) {
        case "Create":


            return await trc_ws_ops.workspace_settings(directoryId)
                .then(() => {
                    var returndata: CloudFormationCustomResourceSuccessResponse =
                    {
                        Status: "SUCCESS",
                        Reason: "",
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "registration",
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
                        PhysicalResourceId: directoryId + "registration",
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };

                    console.log(JSON.stringify(returndata));
                    return returndata;
                });






        // try {
        //     usernames.forEach(async user => {

        //         const password = user + "!";

        //         await trc_ws_ops.create_user(workspaceProps, {
        //             username: user,
        //             password: password,
        //             email: workspaceProps.defaultEmail
        //         });

        //         await trc_ws_ops.create_workspace(workspaceProps, user);

        //     });


        // } catch (error) {

        // }

        // break;

        case "Update":


            break;
        // case "Update":

        //     break;
        case "Delete":



            return await trc_ws_ops.delete_all_workspaces(directoryId).then(async () => {
                return await trc_ws_ops.deregister_directory(directoryId).then(() => {
                    var returndata: CloudFormationCustomResourceSuccessResponse =
                    {
                        Status: "SUCCESS",
                        Reason: "",
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "registration",
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
                            PhysicalResourceId: directoryId + "registration",
                            RequestId: event.RequestId,
                            StackId: event.StackId
                        };

                        console.log(JSON.stringify(returndata));
                        return returndata;
                    });


            })
                .catch(error => {
                    var returndata: CloudFormationCustomResourceFailedResponse =
                    {
                        Status: "FAILED",
                        Reason: JSON.stringify(error),
                        LogicalResourceId: event.LogicalResourceId,
                        PhysicalResourceId: directoryId + "registration",
                        RequestId: event.RequestId,
                        StackId: event.StackId
                    };

                    console.log(JSON.stringify(returndata));
                    return returndata;
                });;



            break;
        default:

    }

    var returndata2: CloudFormationCustomResourceFailedResponse = {
        Status: "FAILED",
        Reason: "Weird Reasons...",
        LogicalResourceId: event.LogicalResourceId,
        PhysicalResourceId: directoryId + "registration",
        RequestId: event.RequestId,
        StackId: event.StackId
    };

    console.log(JSON.stringify(returndata2));
    return returndata2;


}