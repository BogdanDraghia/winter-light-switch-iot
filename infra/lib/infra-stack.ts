import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import {
  CfnCACertificate,
  CfnCertificate,
  CfnPolicy,
  CfnPolicyPrincipalAttachment,
  CfnThing,
  CfnThingPrincipalAttachment,
} from "aws-cdk-lib/aws-iot";

import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";
import {
  CfnIdentityPool,
  CfnIdentityPoolRoleAttachment,
} from "aws-cdk-lib/aws-cognito";
import {
  Effect,
  PolicyDocument,
  PolicyStatement,
  Role,
  WebIdentityPrincipal,
} from "aws-cdk-lib/aws-iam";

interface InfraStackProps extends StackProps {
  thingName: string;
  deviceName: string;
}

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props: InfraStackProps) {
    super(scope, id, props);

    const { thingName, deviceName } = props;

    const certsPath = path.resolve(__dirname, "../certs");

    const caCert = new CfnCACertificate(this, "SensorCACertificate", {
      caCertificatePem: fs.readFileSync(
        path.join(certsPath, `${deviceName}_root_CA_cert.pem`),
        "utf8"
      ),
      status: "ACTIVE",
      verificationCertificatePem: fs.readFileSync(
        path.join(certsPath, `${deviceName}_verification_cert.pem`),
        "utf8"
      ),
      autoRegistrationStatus: "ENABLE",
    });

    const deviceCert = new CfnCertificate(this, "SensorCertificate", {
      status: "ACTIVE",
      certificatePem: fs.readFileSync(
        path.join(certsPath, `${deviceName}_device_cert.pem`),
        "utf8"
      ),
      caCertificatePem: fs.readFileSync(
        path.join(certsPath, `${deviceName}_root_CA_cert.pem`),
        "utf8"
      ),
    });
    deviceCert.node.addDependency(caCert);

    const thing = new CfnThing(this, `${thingName}CfnThing`, {
      thingName: thingName,
    });

    const policy = new CfnPolicy(this, `${deviceName}Policy`, {
      policyName: `${deviceName}Policy`,
      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["iot:Connect"],
            Resource: `arn:aws:iot:${this.region}:${this.account}:client/${thingName}`,
          },
          {
            Effect: "Allow",
            Action: ["iot:Publish", "iot:Receive"],
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:topic/${thingName}/*`,
              `arn:aws:iot:${this.region}:${this.account}:topic/$aws/things/${thingName}/shadow/*`,
              `arn:aws:iot:${this.region}:${this.account}:topic/${thingName}/lifecycle`,
            ],
          },
          {
            Effect: "Allow",
            Action: ["iot:Subscribe"],
            Resource: [
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/${thingName}/*`,
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/$aws/things/${thingName}/shadow/*`,
              `arn:aws:iot:${this.region}:${this.account}:topicfilter/${thingName}/lifecycle`,
            ],
          },
        ],
      },
    });

    new CfnPolicyPrincipalAttachment(this, `${deviceName}PolicyAttachment`, {
      policyName: policy.policyName!,
      principal: deviceCert.attrArn,
    });

    new CfnThingPrincipalAttachment(this, `${deviceName}ThingAttachment`, {
      thingName: thing.thingName!,
      principal: deviceCert.attrArn,
    });

    // cognito
    const identityPool = new CfnIdentityPool(this, "DemoWebsiteIdentityPool", {
      allowUnauthenticatedIdentities: true,
    });

    // iam role no auth
    const noAuthRole = new Role(this, "DemoWebsiteNoAuthRole", {
      assumedBy: new WebIdentityPrincipal("cognito-identity.amazonaws.com", {
        StringEquals: {
          "cognito-identity.amazonaws.com:aud": identityPool.ref,
        },
      }),

      description: "guest access",
      inlinePolicies: {
        IotShadowAccess: new PolicyDocument({
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["iot:Connect"],
              resources: [
                `arn:aws:iot:${this.region}:${this.account}:client/*`,
              ],
            }),

            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["iot:Subscribe"],
              resources: [
                `arn:aws:iot:${this.region}:${this.account}:topicfilter/$aws/things/${thingName}/shadow/*`,
                `arn:aws:iot:${this.region}:${this.account}:topicfilter/${thingName}/*`,
              ],
            }),

            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: ["iot:Publish", "iot:Receive"],
              resources: [
                `arn:aws:iot:${this.region}:${this.account}:topic/$aws/things/${thingName}/shadow/*`,
                `arn:aws:iot:${this.region}:${this.account}:topic/${thingName}/*`,
              ],
            }),
          ],
        }),
      },
    });
    new CfnIdentityPoolRoleAttachment(
      this,
      "DemoWebsiteIdentityPoolRoleAttachment",
      {
        identityPoolId: identityPool.ref,
        roles: {
          unauthenticated: noAuthRole.roleArn,
        },
      }
    );

    // output identity pool id
    new CfnOutput(this, "IdentityPoolId", {
      value: identityPool.ref,
      description: "COGNITO_IDENTITY_POOL_ID",
    });
  }
}
