#!/bin/bash

# install dependencies for all lambda functions and transpile ts to js
cd lambda/workspace-registration-handler &&
npm install &&
tsc

cd ../workspace-create-workspace &&
npm install &&
tsc

cd ../workspace-create-ldap-user &&
npm install &&
tsc

cd ../..
# install dependencies for main program
npm install

# transpile ts to js
npm run build
