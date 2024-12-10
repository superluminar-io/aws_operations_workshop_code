import * as awsx from "@pulumi/awsx";
import * as ecs from "@pulumi/awsx/ecs";
import * as classic from "@pulumi/awsx/classic";
import * as apigateway from "@pulumi/aws/apigateway";
import * as lambda from "@pulumi/aws/lambda";
import * as pulumi from "@pulumi/pulumi";
import * as iam from "@pulumi/aws/iam";


const vpc = classic.ec2.Vpc.getDefault();

const cluster = new classic.ecs.Cluster("cluster");

// Create a load balancer on port 80 and spin up two instances of Nginx.
const lb = new classic.lb.ApplicationListener("nginx-lb", {port: 8080});
const targetGroup = lb.defaultTargetGroup!.targetGroup;

// docker cp tmp-nginx-container:/etc/nginx/nginx.conf /host/path/nginx.conf
const fargateTask = new ecs.FargateTaskDefinition("fargate-task", {
  container: {
    image: "nginx:alpine",
    name: "nginx",
    cpu: 512,
    memory: 128,
    essential: true,
    portMappings: [{targetGroup}],
    // command: ["COPY", "/etc/nginx/nginx.conf", "nginx.conf"],
  },
});

const service = new ecs.FargateService("my-service", {
  cluster: cluster.cluster.arn,
  taskDefinition: fargateTask.taskDefinition.arn,
  loadBalancers: fargateTask.loadBalancers,
  networkConfiguration: {
    subnets: vpc.publicSubnetIds,
    assignPublicIp: true,
  },
});

// Export the load balancer's address so that it's easy to access.
export const url = lb.endpoint.hostname;


// API Gateway & Lambda
//Lambda function
// const lambdaRole = new iam.Role("lambdaRole", {
//   assumeRolePolicy: iam.assumeRolePolicyForPrincipal({Service: "lambda.amazonaws.com"}),
// });
//
// const lambdaPolicy = new iam.RolePolicy("lambdaPolicy", {
//   role: lambdaRole.id,
//   policy: pulumi.output({
//     Version: "2012-10-17",
//     Statement: [{
//       Action: "lambda:InvokeFunction",
//       Effect: "Allow",
//       Resource: "*",
//     }],
//   }),
// });
//
// const lambdaFunction = new lambda.Function("myFunction", {
//   runtime: lambda.Runtime.NodeJS20dX,
//   role: lambdaRole.arn,
//   handler: "index.handler",
//   code: new pulumi.asset.AssetArchive({
//     ".": new pulumi.asset.FileArchive("./lambda"),
//   }),
// });
//
// // RestAPI
// const api = new apigateway.RestApi("myApi", {
//   description: "API Gateway example",
// });
//
// const resource = new apigateway.Resource("myResource", {
//   restApi: api.id,
//   parentId: api.rootResourceId,
//   pathPart: "myresource",
// });
//
// const method = new apigateway.Method("myMethod", {
//   restApi: api.id,
//   resourceId: resource.id,
//   httpMethod: "GET",
//   authorization: "NONE",
// });
//
// const integration = new apigateway.Integration("myIntegration", {
//   restApi: api.id,
//   resourceId: resource.id,
//   httpMethod: method.httpMethod,
//   integrationHttpMethod: "POST",
//   type: "AWS_PROXY",
//   uri: lambdaFunction.invokeArn,
// });
//
// const deployment = new apigateway.Deployment("myDeployment", {
//   restApi: api.id,
// }, {dependsOn: [method]});
//
// const stage = new apigateway.Stage("myStage", {
//   restApi: api.id,
//   deployment: deployment.id,
//   stageName: "test",
// });
//
//
// new lambda.Permission("apiGatewayPermission", {
//   action: "lambda:InvokeFunction",
//   function: lambdaFunction.name,
//   principal: "apigateway.amazonaws.com",
//   sourceArn: pulumi.interpolate`${api.executionArn}/*/*`,
// });
//
//
// // Export the URL of the deployed API
// export const apiUrl = pulumi.interpolate`${deployment.invokeUrl}/myresource`;
//
// Alternative: Lambda as Targetgroup Attachement