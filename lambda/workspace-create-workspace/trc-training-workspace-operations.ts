import { Attribute, Change, Client, DN, RDN, } from "ldapts";
import { TerminateRequest, CreateWorkspacesCommand, CreateWorkspacesRequest, WorkSpacesClient, WorkspaceRequest, RegisterWorkspaceDirectoryCommand, ModifyWorkspaceAccessPropertiesCommand, TerminateWorkspacesCommand, DescribeWorkspacesCommand, TerminateWorkspacesRequest, DeregisterWorkspaceDirectoryCommand } from "@aws-sdk/client-workspaces";
import { DeleteDirectoryCommand, DescribeDirectoriesCommand, DirectoryServiceClient, ResetUserPasswordCommand } from "@aws-sdk/client-directory-service";
// import { compileFunction } from "node:vm";
//test
export interface user_info {
    username: string, email: string, password: string
}
export interface workspace_props {
    directory: string,
    bundle: string,
    domain: string,
    baseDN: string,
    endpointUrl: string,
    adminUser: string,
    adminPassword: string,
    defaultEmail: string,
    runningMode?: "AUTO_STOP" | "ALWAYS_ON"
}


const wsClient = new WorkSpacesClient({});
const dsClient = new DirectoryServiceClient({});

export async function setupTrainingWorkspaces(workspace_props: workspace_props, userAmount: number) {


    //initial setup
    await workspace_settings(workspace_props.directory);


    //get usernames
    const usernames = get_user_names(userAmount);

    usernames.forEach(async user => {

        const password = user + "!";

        await create_user(workspace_props, {
            username: user,
            password: password,
            email: workspace_props.defaultEmail
        });

        await create_workspace(workspace_props, user);

    });

}


export function get_user_names(userAmount: number): Array<string> {

    var users: Array<string> = [];

    for (let index = 0; index < userAmount; index++) {

        users.push("training" + (index + 1).toString().padStart(2, "0"));

    }

    return users;
}




export async function create_workspace(workspace_props: workspace_props, user: string): Promise<string> {
    var array: Array<WorkspaceRequest> = [];

    array.push({
        BundleId: workspace_props.bundle,
        DirectoryId: workspace_props.directory,
        UserName: user,
        WorkspaceProperties: {
            RunningMode: workspace_props.runningMode
        }
    })



    var command = new CreateWorkspacesCommand({
        Workspaces: array
    })

    console.log("creating workspace for user " + user);
    console.log(JSON.stringify(command));

    const workspaceId = await wsClient.send(command).catch(error => {
        console.log("error occurred");
        console.log(error);
        throw error;
    })

        .then(result => {
            console.log(JSON.stringify(result));
            if (result.FailedRequests?.length === 0 && result.PendingRequests?.length !== 0 && result.PendingRequests !== undefined) {
                return result.PendingRequests[0].WorkspaceId as string;
            }
            else {
                throw new Error("Workspace creation request failed");
            }

        })

        .catch(error => {
            console.error("error during api call");
            console.error(error);
            throw new Error(error);
        });


    console.log(JSON.stringify("Workspace " + workspaceId + " created"));

    return workspaceId;
}

export async function workspace_settings(directoryId: string) {

    console.log("test version 2");

    //register directory
    console.log("registering directory");
    const register_command = new RegisterWorkspaceDirectoryCommand({
        DirectoryId: directoryId,
        EnableWorkDocs: false
    });



    const result = await wsClient.send(register_command)
        .catch(error => {
            console.log("Error registering directory");
            console.log(error);
            throw error;
        });
    console.log(JSON.stringify(result));





    //allow all access
    console.log("setting access properties");
    const settings_command = new ModifyWorkspaceAccessPropertiesCommand({
        ResourceId: directoryId,
        WorkspaceAccessProperties: {
            DeviceTypeIos: "ALLOW",
            DeviceTypeOsx: "ALLOW",
            DeviceTypeWeb: "ALLOW",
            DeviceTypeWindows: "ALLOW",
            DeviceTypeZeroClient: "ALLOW",
            DeviceTypeAndroid: "ALLOW",
            DeviceTypeChromeOs: "ALLOW",
        }
    });
    const result2 = await wsClient.send(settings_command)
        .catch(error => {
            console.log("Error setting access properties");
            console.log(error);
            throw error;
        });
    console.log(JSON.stringify(result2));


}

export async function create_user(workspace_props: workspace_props, user_props: user_info) {

    console.log(workspace_props);



    const ldapClient = new Client({
        strictDN: false,
        url: 'ldap://' + workspace_props.endpointUrl,
        timeout: 5000
    });

    try {

        await ldapClient.bind("CN=" + workspace_props.adminUser + "," + workspace_props.baseDN, workspace_props.adminPassword);

        console.log("connected");

        await ldapClient.add("CN=" + user_props.username + ", " + workspace_props.baseDN, {
            "sn": [user_props.username],
            "sAMAccountName": [user_props.username],
            "userPrincipalName": [user_props.username + "@" + workspace_props.domain],
            "mail": [user_props.email],
            "givenName": [user_props.username],
            "objectclass": 'user'
        })
            .then(() => {
                console.log("success creating user");
            })
            .catch(err => {
                console.log(err);

                var errorText: string = err.message;

                if (err.code = 68) {
                    //user already exists, that is ok.
                    console.log(err);
                    console.log("error ignored");
                }
                else {
                    console.log("error creating user");
                    console.log(err);
                    throw err;
                }
            });



        //set password
        await change_pwd(user_props.username, user_props.password, workspace_props.directory);

    } catch (ex) {
        // isAuthenticated = false;
        console.log(ex);
        throw ex;
    } finally {
        await ldapClient.unbind();
    }
}

export async function change_pwd(user: string, password: string, directoryID: string) {
    console.log("changing user password");
    const chg_password_command = new ResetUserPasswordCommand({
        DirectoryId: directoryID,
        UserName: user,
        NewPassword: password
    })
    const result = await dsClient.send(chg_password_command).catch(error => {
        console.log("error occurred");
        console.log(error);
        throw error;
    })


    console.log(JSON.stringify(result))
}


export async function delete_all_workspaces(directoryId: string) {


    console.log("deleting all workspaces");
    console.log("directoryId: " + directoryId);

    //first get all workspaces
    const get_command = new DescribeWorkspacesCommand({
        DirectoryId: directoryId
    });

    console.log(get_command);


    var term_requests: Array<TerminateRequest>;

    const get_result = await wsClient.send(get_command)

        .catch(error => {
            console.error("error during api call");
            console.error(error);
            throw new Error(error);
        });;

    console.log(get_result);

    if (get_result.Workspaces !== undefined) {


        term_requests = get_result.Workspaces.map(workspace => {
            console.log("found workspace: " + workspace.WorkspaceId + " of User " + workspace.UserName);
            return {
                WorkspaceId: workspace.WorkspaceId
            };
        })

    }
    else {
        const error = "no workspaces found"
        // console.error(error);

        // throw Error(error)

        return;

    }

    //delete workspaces
    console.log("deleting workspaces");
    const register_command = new TerminateWorkspacesCommand({
        TerminateWorkspaceRequests: term_requests
    })
    // console.log(JSON.stringify(await wsClient.send(register_command)));

    const result = await wsClient.send(register_command).catch(error => {
        console.log("error occurred");
        console.log(error);
        throw error;
    })


    console.log(JSON.stringify(result))

}

export async function delete_workspace(workspaceId: string) {


    console.log("delete workspace " + workspaceId);

    // //first get all workspaces
    // const get_command = new DescribeWorkspacesCommand({
    //     DirectoryId: directoryId
    // });


    var term_requests: Array<TerminateRequest> = [
        {
            WorkspaceId: workspaceId
        }
    ];




    //delete workspace
    const delete_command = new TerminateWorkspacesCommand({
        TerminateWorkspaceRequests: term_requests
    })
    // console.log(JSON.stringify(await wsClient.send(register_command)));

    const result = await wsClient.send(delete_command).catch(error => {
        console.log("error occurred");
        console.log(error);
        throw error;
    })


    console.log(JSON.stringify(result))

}


export async function deregister_directory(directoryId: string) {

    //first delete all workspaces
    await delete_all_workspaces(directoryId);


    //then deregister
    //register directory
    console.log("de-registering directory");
    const deregister_command = new DeregisterWorkspaceDirectoryCommand({
        DirectoryId: directoryId
    });
    // console.log(JSON.stringify(await wsClient.send(deregister_command)));

    const result = await wsClient.send(deregister_command).catch(error => {
        console.log("error occurred");
        console.log(error);
        throw error;
    })


    console.log(JSON.stringify(result))

}



