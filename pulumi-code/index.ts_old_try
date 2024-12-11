import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";
import * as classic from "@pulumi/awsx/classic";

const vpc = classic.ec2.Vpc.getDefault();

// 1. Create an ECS Cluster
const ecsCluster = new aws.ecs.Cluster("ecs-cluster");

// 2. Define the Nginx Task Definition
const nginxTaskRole = new aws.iam.Role("nginx-task-role", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "ecs-tasks.amazonaws.com" }),
});

const nginxTaskDefinition = new aws.ecs.TaskDefinition("nginx-task", {
  family: "nginx-task",
  cpu: "256",
  memory: "512",
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  executionRoleArn: nginxTaskRole.arn,
  containerDefinitions: JSON.stringify([{
    name: "nginx",
    image: "nginx:latest",
    essential: true,
    portMappings: [{ containerPort: 80, hostPort: 80 }],
  }]),
});

// 3. Create a Service for the Nginx Task
const nginxService = new aws.ecs.Service("nginx-service", {
  cluster: ecsCluster.arn,
  desiredCount: 1,
  launchType: "FARGATE",
  taskDefinition: nginxTaskDefinition.arn,
  networkConfiguration: {
    assignPublicIp: true,
    subnets: vpc.publicSubnetIds,
   // TODO: securityGroups: [],
  },
});

// 4. Create a DynamoDB Table
const dynamoTable = new aws.dynamodb.Table("itemsTable", {
  attributes: [{ name: "id", type: "S" }],
  hashKey: "id",
  billingMode: "PAY_PER_REQUEST",
});

// 5. Create IAM Roles for the Lambda Functions
const lambdaRole = new aws.iam.Role("lambdaRole", {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "lambda.amazonaws.com" }),
});

new aws.iam.RolePolicyAttachment("lambdaRolePolicy", {
  role: lambdaRole.name,
  policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
});

new aws.iam.RolePolicy("dynamodbAccessPolicy", {
  role: lambdaRole.name,
  policy: pulumi.output(dynamoTable.arn).apply(arn => JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["dynamodb:GetItem", "dynamodb:PutItem"],
        Resource: arn,
      },
    ],
  })),
});

// 6. Define Lambda Functions for Get and Put
const getLambda = new aws.lambda.Function("getLambda", {
  runtime: "nodejs18.x",
  handler: "index.handler",
  role: lambdaRole.arn,
  code: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.FileArchive("./src/getLambda"),
  }),
  environment: {
    variables: { TABLE_NAME: dynamoTable.name },
  },
});

const putLambda = new aws.lambda.Function("putLambda", {
  runtime: "nodejs18.x",
  handler: "index.handler",
  role: lambdaRole.arn,
  code: new pulumi.asset.AssetArchive({
    ".": new pulumi.asset.FileArchive("./src/putLambda"),
  }),
  environment: {
    variables: { TABLE_NAME: dynamoTable.name },
  },
});

// 7. Create the REST API
const restApi = new aws.apigateway.RestApi("restApi", {
  name: "MyRestApi",
});

// Define resources (paths)
const rootResource = new aws.apigateway.Resource("rootResource", {
  restApi: restApi.id,
  parentId: restApi.rootResourceId,
  pathPart: "resource",
});

// Create Lambda integration for GET
// const getIntegration = new aws.apigateway.Integration("getIntegration", {
//   restApi: restApi.id,
//   resourceId: rootResource.id,
//   httpMethod: "GET",
//   type: "AWS_PROXY",
//   integrationHttpMethod: "POST",
//   uri: getLambda.arn,
// });

// Create Lambda integration for PUT
// const putIntegration = new aws.apigateway.Integration("putIntegration", {
//   restApi: restApi.id,
//   resourceId: rootResource.id,
//   httpMethod: "PUT",
//   type: "AWS_PROXY",
//   integrationHttpMethod: "POST",
//   uri: putLambda.arn,
// });

// Define GET method
const getMethod = new aws.apigateway.Method("getMethod", {
  restApi: restApi.id,
  resourceId: rootResource.id,
  httpMethod: "GET",
  authorization: "NONE",
});

// Define PUT method
const putMethod = new aws.apigateway.Method("putMethod", {
  restApi: restApi.id,
  resourceId: rootResource.id,
  httpMethod: "PUT",
  authorization: "NONE",
});

// Deploy the REST API
// const deployment = new aws.apigateway.Deployment("restApiDeployment", {
//   restApi: restApi.id,
//
// },
//   {
//     dependsOn: [restApi, getMethod, putMethod],
//   });
//
// const stage = new aws.apigateway.Stage("stage", {
//   restApi: restApi.id,
//   stageName: "test",
//   deployment: deployment.id,
// });

// Export the endpoint URL
// export const apiEndpoint = deployment.invokeUrl;
