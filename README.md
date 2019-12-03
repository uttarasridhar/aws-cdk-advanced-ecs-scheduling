## Prerequisites

To perform this workshop, you’ll need the following:

* aws-cli. Installation instructions [here](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-install.html)
* Setup your AWS account credentials `aws configure`
* node.js. Installation instructions [here](https://nodejs.org) and version should be >= 8.12.0
* IDE or editor of choice.
* aws-cdk. Installation instructions: `npm install -g aws-cdk`

## Setup workspace with Typescript
* Compile your Typescript code: Open a new terminal tab and navigate to the project directory. Run `npm run watch`
* Open your IDE or editor of choice and explore the project structure. App's entry point is cdk.json -> bin/aws-cdk-advanced-ecs-scheduling.ts -> lib/aws-cdk-advanced-ecs-scheduling-stack.ts

## Synthesize and deploy

* `cdk synth` generates an AWS CloudFormation template for your application stack.
* The first time you deploy an AWS CDK app into an environment (account/region), you’ll need to install a “bootstrap stack”. `cdk bootstrap`
* Let's deploy. `cdk deploy`. Once the deployment completes, you can look at your load balanced service URL as an output.

## Clean up
* `cdk destroy`
