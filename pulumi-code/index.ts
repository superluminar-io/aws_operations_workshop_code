import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";


// Create ECR Repository
const repository = new aws.ecr.Repository("workshop-app", {
  name: "workshop-app",
  imageScanningConfiguration: {
    scanOnPush: true,
  },
  forceDelete: true,
});

// Create SQS Queue
const deadLetterQueue = new aws.sqs.Queue("workshop-dlq");
const queue = deadLetterQueue.arn.apply(
  (dlqArn) =>
    new aws.sqs.Queue("workshop-queue", {
      visibilityTimeoutSeconds: 30,
      messageRetentionSeconds: 86400,
      redrivePolicy: JSON.stringify({
        deadLetterTargetArn: dlqArn,
        maxReceiveCount: 3,
      }),
    })
);
// Create Lambda Role
const lambdaRole = new aws.iam.Role("message-processor-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "lambda.amazonaws.com",
        },
      },
    ],
  }),
  managedPolicyArns: [
    // to allow the lambda function to send logs to CloudWatch
    "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  ],
});
// Add SQS permissions to Lambda Role
new aws.iam.RolePolicy("lambda-sqs-policy", {
  role: lambdaRole.id,
  policy: queue.arn.apply((arn) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: [
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes",
          ],
          Resource: arn,
        },
      ],
    })
  ),
});
// Create Lambda Function
const processor = new aws.lambda.Function("message-processor", {
  runtime: "nodejs18.x",
  handler: "index.handler",
  role: lambdaRole.arn,
  code: new pulumi.asset.AssetArchive({
    "index.js": new pulumi.asset.StringAsset(
      `exports.handler = async (event) => { console.log(JSON.stringify(event, 2, null)); return { statusCode: 200 }; }; `
    ),
  }),
});
// Add SQS trigger to Lambda
new aws.lambda.EventSourceMapping("queue-trigger", {
  eventSourceArn: queue.arn,
  functionName: processor.name,
  batchSize: 1,
});

const taskRole = new aws.iam.Role("ecs-task-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "ecs-tasks.amazonaws.com",
        },
      },
    ],
  }),
});

new aws.iam.RolePolicy("task-sqs-policy", {
  role: taskRole.id,
  policy: pulumi.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["sqs:SendMessage"],
        Resource: queue.arn,
      },
    ],
  }),
});

// Create VPC
const vpc = new aws.ec2.Vpc("workshop-vpc", {
  cidrBlock: "10.0.0.0/16",
  enableDnsHostnames: true,
  enableDnsSupport: true,
});
// Create Internet Gateway
const internetGateway = new aws.ec2.InternetGateway("workshop-igw", {
  vpcId: vpc.id,
});
// Create Public Subnets in different AZs
const publicSubnet1 = new aws.ec2.Subnet("workshop-public-1", {
  vpcId: vpc.id,
  cidrBlock: "10.0.1.0/24",
  availabilityZone: "eu-central-1a",
  mapPublicIpOnLaunch: true,
});
const publicSubnet2 = new aws.ec2.Subnet("workshop-public-2", {
  vpcId: vpc.id,
  cidrBlock: "10.0.2.0/24",
  availabilityZone: "eu-central-1b",
  mapPublicIpOnLaunch: true,
});
// Create NAT Gateway (in public subnet)
const eip = new aws.ec2.Eip("nat-eip", {});
const natGateway = new aws.ec2.NatGateway("nat-gateway", {
  allocationId: eip.id,
  subnetId: publicSubnet1.id,
});
// Create Private Subnets
const privateSubnet1 = new aws.ec2.Subnet("workshop-private-1", {
  vpcId: vpc.id,
  cidrBlock: "10.0.3.0/24",
  availabilityZone: "eu-central-1a",
});
const privateSubnet2 = new aws.ec2.Subnet("workshop-private-2", {
  vpcId: vpc.id,
  cidrBlock: "10.0.4.0/24",
  availabilityZone: "eu-central-1b",
});
// Create Route Tables and Routes
const publicRouteTable = new aws.ec2.RouteTable("workshop-public-rt", {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      gatewayId: internetGateway.id,
    },
  ],
});
// Associate Public Subnets with Public Route Table
new aws.ec2.RouteTableAssociation("workshop-public-rt-assoc-1", {
  subnetId: publicSubnet1.id,
  routeTableId: publicRouteTable.id,
});
new aws.ec2.RouteTableAssociation("workshop-public-rt-assoc-2", {
  subnetId: publicSubnet2.id,
  routeTableId: publicRouteTable.id,
});
const privateRouteTable = new aws.ec2.RouteTable("workshop-private-rt", {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: "0.0.0.0/0",
      natGatewayId: natGateway.id,
    },
  ],
});
// Associate Private Subnets with Private Route Table
new aws.ec2.RouteTableAssociation("workshop-private-rt-assoc-1", {
  subnetId: privateSubnet1.id,
  routeTableId: privateRouteTable.id,
});
new aws.ec2.RouteTableAssociation("workshop-private-rt-assoc-2", {
  subnetId: privateSubnet2.id,
  routeTableId: privateRouteTable.id,
});
// Create ECS Cluster
const cluster = new aws.ecs.Cluster("workshop-cluster", {
  name: "workshop-cluster",
});
// Create Task Execution Role
const taskExecutionRole = new aws.iam.Role("ecs-task-execution-role", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: {
          Service: "ecs-tasks.amazonaws.com",
        },
      },
    ],
  }),
});
new aws.iam.RolePolicyAttachment("ecs-task-execution-role-policy", {
  role: taskExecutionRole.name,
  policyArn:
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});

// Create CloudWatch Log Group
const logGroup = new aws.cloudwatch.LogGroup("workshop-log-group", {
  name: "/ecs/workshop-app",
  retentionInDays: 7,
});

// Create Task Definition
const containerName = "workshop-app";
const taskDefinition = new aws.ecs.TaskDefinition("workshop-task", {
  family: "workshop-app",
  cpu: "256",
  memory: "512",
  networkMode: "awsvpc",
  requiresCompatibilities: ["FARGATE"],
  executionRoleArn: taskExecutionRole.arn,
  containerDefinitions: pulumi.jsonStringify([
    {
      name: containerName,
      image: pulumi.interpolate`${repository.repositoryUrl}:latest`,
      portMappings: [
        {
          containerPort: 80,
          protocol: "tcp",
        },
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": logGroup.name,
          "awslogs-region": "eu-central-1",
          "awslogs-stream-prefix": "ecs",
        },
      },
    },
  ]),
});

// Create Security Group for ECS Tasks
const taskSg = new aws.ec2.SecurityGroup("task-sg", {
  vpcId: vpc.id,
});
new aws.vpc.SecurityGroupIngressRule("task-sg-allow-http-ipv4", {
  securityGroupId: taskSg.id,
  cidrIpv4: "0.0.0.0/0",
  ipProtocol: "tcp",
  fromPort: 80,
  toPort: 80,
});
new aws.vpc.SecurityGroupEgressRule("task-sg-allow-all-traffic-ipv4", {
  securityGroupId: taskSg.id,
  cidrIpv4: "0.0.0.0/0",
  ipProtocol: "-1",
});



// Create Security Group for ALB
const albSg = new aws.ec2.SecurityGroup("alb-sg", {
  vpcId: vpc.id,
  description: "Security group for ALB",
});

// Update ECS Task Security Group Ingress Rule to allow traffic from ALB
new aws.vpc.SecurityGroupIngressRule("task-sg-allow-http-ipv4", {
  securityGroupId: taskSg.id,
  ipProtocol: "tcp",
  fromPort: 80,
  toPort: 80,
  referencedSecurityGroupId: albSg.id,
});

new aws.vpc.SecurityGroupEgressRule("alb-sg-allow-all-traffic-ipv4", {
  securityGroupId: albSg.id,
  cidrIpv4: "0.0.0.0/0",
  ipProtocol: "-1",
});

// Create Target Group
const targetGroup = new aws.lb.TargetGroup("workshop-tg", {
  port: 80,
  protocol: "HTTP",
  targetType: "ip",
  vpcId: vpc.id,
  healthCheck: {
    enabled: true,
    path: "/",
    healthyThreshold: 2,
    unhealthyThreshold: 10,
  },
});
// Create Application Load Balancer
const alb = new aws.lb.LoadBalancer("workshop-alb", {
  internal: false,
  loadBalancerType: "application",
  securityGroups: [albSg.id],
  subnets: [publicSubnet1.id, publicSubnet2.id],
});
// Create ALB Listener
new aws.lb.Listener("workshop-listener", {
  loadBalancerArn: alb.arn,
  port: 80,
  protocol: "HTTP",
  defaultActions: [
    {
      type: "forward",
      targetGroupArn: targetGroup.arn,
    },
  ],
});

// Update ECS Service with Load Balancer
const service = new aws.ecs.Service("workshop-service", {
  cluster: cluster.id,
  taskDefinition: taskDefinition.arn,
  desiredCount: 2,
  launchType: "FARGATE",
  networkConfiguration: {
    subnets: [privateSubnet1.id, privateSubnet2.id],
    securityGroups: [taskSg.id],
    assignPublicIp: false,
  },
  waitForSteadyState: true,
  deploymentCircuitBreaker: {
    enable: true,
    rollback: false,
  },
  loadBalancers: [
    {
      targetGroupArn: targetGroup.arn,
      containerName: containerName,
      containerPort: 80,
    },
  ],
});

// Create Auto Scaling Target
const scalableTarget = new aws.appautoscaling.Target(
  "workshop-scaling-target",
  {
    maxCapacity: 5,
    minCapacity: 2,
    resourceId: pulumi.interpolate`service/${cluster.name}/${service.name}`,
    scalableDimension: "ecs:service:DesiredCount",
    serviceNamespace: "ecs",
  }
);
// Create CPU-based Scaling Policy
const cpuPolicy = new aws.appautoscaling.Policy("cpu-policy", {
  policyType: "TargetTrackingScaling",
  resourceId: scalableTarget.resourceId,
  scalableDimension: scalableTarget.scalableDimension,
  serviceNamespace: scalableTarget.serviceNamespace,
  targetTrackingScalingPolicyConfiguration: {
    predefinedMetricSpecification: {
      predefinedMetricType: "ECSServiceAverageCPUUtilization",
    },
    targetValue: 20.0,
    scaleInCooldown: 60, // 1 minute
    scaleOutCooldown: 60, // 1 minute
  },
});


// Export ALB DNS name
export const albDnsName = alb.dnsName;

// Export the repository URL
export const repositoryUrl = repository.repositoryUrl;
