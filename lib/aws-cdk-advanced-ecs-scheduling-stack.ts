import cdk = require('@aws-cdk/core');
import ec2 = require("@aws-cdk/aws-ec2");
import ecs = require("@aws-cdk/aws-ecs");
import ecsPatterns = require("@aws-cdk/aws-ecs-patterns");
import autoscale = require("@aws-cdk/aws-applicationautoscaling");

export class AwsCdkAdvancedEcsSchedulingStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "MyVpc", {
      maxAzs: 3 // Default is all AZs in region
    });

    const cluster = new ecs.Cluster(this, "MyCluster", {
      vpc: vpc
    });

    cluster.addCapacity('small-instances', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      desiredCapacity: 3
    });

    cluster.addCapacity('gpu-instances', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.G3, ec2.InstanceSize.XLARGE4),
      machineImage: new ecs.EcsOptimizedAmi({ hardwareType: ecs.AmiHardwareType.GPU }),
      desiredCapacity: 2
    });

    ///////////////////////////////////////////////////////////////
    // 1. A basic web service
    ///////////////////////////////////////////////////////////////
    const webTaskDefinition = new ecs.Ec2TaskDefinition(this, 'web-task');

    const webContainer = webTaskDefinition.addContainer('web', {
      image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      memoryLimitMiB: 256,
    });

    webContainer.addPortMappings({
      containerPort: 80,
      hostPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    // Create Service
    const webService = new ecs.Ec2Service(this, 'web-service', {
      cluster,
      taskDefinition: webTaskDefinition,
      desiredCount: 2
    });

    // Randomly distribute the tasks
    //service.placeRandomly();

    // Distribute the tasks evenly across availability zones
    /*service.addPlacementStrategies(
      ecs.PlacementStrategy.spreadAcross(ecs.BuiltInAttributes.AVAILABILITY_ZONE)
    );*/

    // Spread across AZ's but also binpack on MEMORY
    webService.addPlacementStrategies(
      ecs.PlacementStrategy.packedBy(ecs.BinPackResource.MEMORY),
      ecs.PlacementStrategy.spreadAcross(ecs.BuiltInAttributes.AVAILABILITY_ZONE)
    );

    ///////////////////////////////////////////////////////////////
    // 2. A basic GPU service
    ///////////////////////////////////////////////////////////////
    const gpuTaskDefinition = new ecs.Ec2TaskDefinition(this, 'gpu-task');

    const gpuContainer = gpuTaskDefinition.addContainer('gpu', {
      essential: true,
      image: ecs.ContainerImage.fromRegistry('nvidia/cuda:9.0-base'),
      memoryLimitMiB: 80,
      cpu: 100,
      gpuCount: 1,
      command: [
        "sh",
        "-c",
        "nvidia-smi && sleep 3600"
      ],
      logging: new ecs.AwsLogDriver({ streamPrefix: 'gpu-service', logRetention: 1 })
    });

    // Create Service
    const gpuService = new ecs.Ec2Service(this, 'gpu-service', {
      cluster,
      taskDefinition: gpuTaskDefinition
    });


    ////////////////////////////////////////////////////////////////
    // 3. Ordered container service
    ////////////////////////////////////////////////////////////////
    const orderedTaskDefinition = new ecs.Ec2TaskDefinition(this, 'ordered-task', {
      networkMode: ecs.NetworkMode.AWS_VPC
    });

    // An ephemeral container that runs to completion and exits
    const initialWorkContainer = orderedTaskDefinition.addContainer('initial-work', {
      essential: false,
      image: ecs.ContainerImage.fromRegistry('alpine:3.10'),
      memoryLimitMiB: 80,
      cpu: 100,
      command: [
        "sh",
        "-c",
        "echo 'Working...' && sleep 5 && echo 'Done'"
      ],
      logging: new ecs.AwsLogDriver({ streamPrefix: 'ordered-task', logRetention: 1 })
    });

    // A dependency that provides some service via a web endpoint.
    const serverDependency = orderedTaskDefinition.addContainer('simple-server-dependency', {
      essential: true,
      image: ecs.ContainerImage.fromRegistry('nathanpeck/name'),
      memoryLimitMiB: 256,
      cpu: 100,
      environment: {
        PORT: '3000'
      },
      healthCheck: {
        command: [
          'CMD-SHELL',
          'curl localhost:3000'
        ],
        interval: cdk.Duration.seconds(5),
        timeout: cdk.Duration.seconds(2),
        retries: 3
      },
      logging: new ecs.AwsLogDriver({ streamPrefix: 'ordered-task', logRetention: 1 })
    });

    // Ensure that the ephemeral container ran to completion first, before starting the
    // server dependency.
    serverDependency.addContainerDependencies({
      container: initialWorkContainer,
      condition: ecs.ContainerDependencyCondition.SUCCESS
    });

    // The actual application of this task.
    const server = orderedTaskDefinition.addContainer('need-server-dependency', {
      essential: true,
      image: ecs.ContainerImage.fromRegistry('nathanpeck/name'),
      memoryLimitMiB: 256,
      cpu: 100,
      environment: {
        PORT: '3001'
      },
      logging: new ecs.AwsLogDriver({ streamPrefix: 'ordered-task', logRetention: 1 })
    });

    // Ensure that the application's dependency is both up and healthy on its endpoint
    // prior to starting the application
    server.addContainerDependencies({
      container: serverDependency,
      condition: ecs.ContainerDependencyCondition.HEALTHY
    });

    // Create Service
    const orderedDependencyService = new ecs.Ec2Service(this, 'dependency-service', {
      cluster,
      taskDefinition: orderedTaskDefinition
    });

    ////////////////////////////////////////////////////////////////
    // 4. Time-based/scheduled task
    ////////////////////////////////////////////////////////////////

    const scheduledFargateTask = new ecsPatterns.ScheduledFargateTask(this, 'ScheduledFargateTask', {
      cluster,
      schedule: autoscale.Schedule.expression('cron(0/5 * * * ? *)'),
      scheduledFargateTaskImageOptions: {
        memoryLimitMiB: 512,
        cpu: 256,
        command: [
          'sh',
          '-c',
          'sleep 5',
        ],
        image: ecs.ContainerImage.fromRegistry('amazonlinux:2'),
      },
    });
  }
}
