import {
    APIGatewayClient,
    CreateBasePathMappingCommand,
    CreateDeploymentCommand,
    CreateDomainNameCommand,
    CreateResourceCommand,
    CreateRestApiCommand,
    EndpointType,
    GetResourcesCommand,
    GetRestApisCommand,
    IntegrationType,
    PutIntegrationCommand,
    PutMethodCommand,
    PutMethodResponseCommand
} from '@aws-sdk/client-api-gateway';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { fromEnv } from '@aws-sdk/credential-providers';

const apiGateway = new APIGatewayClient({ region: 'us-east-1', credentials: fromEnv()});
const lambda = new LambdaClient({ region: 'us-east-1', credentials: fromEnv()});

export const connectToApiGateway = async(
    name: string,
    gatewayName: string,
    domainName: string,
    accountId: string,
    FunctionName: string,
    regionalCertificateArn: string,
): Promise<void> => {
    try {
        console.log('Fetching existing APIs...');
        const restApis = await apiGateway.send(new GetRestApisCommand({ limit: 500 }));
        let api = restApis.items?.find(api => api.name === name);

        if (!api) {
            console.log('Creating new API Gateway...');
            const createApiParams = {
                name,
                description: 'API Gateway for my Lambda function',
                protocol: 'REST',
            };

            api = await apiGateway.send(new CreateRestApiCommand(createApiParams));
            console.log(`API Gateway ${name} created successfully.`);
        } else {
            console.log(`Found existing API Gateway: ${api.name}`);
        }

        console.log('Fetching resources...');
        const resources = await apiGateway.send(new GetResourcesCommand({ restApiId: api.id!, limit: 500 }));
        let rootResource = resources.items?.find(resource => resource.path === '/');

        // If the rootResource does not exist, create it
        if (!rootResource) {
            console.log('Creating root resource...');
            const createRootResourceParams = {
                parentId: api.id!,
                pathPart: '/',
                restApiId: api.id!,
            };
            rootResource = await apiGateway.send(new CreateResourceCommand(createRootResourceParams));
            console.log(`Root resource created successfully.`);
        } else {
            console.log('Found existing root resource.');
        }

        const resourcePaths = ['/', '/{proxy+}'];
        for (const resourcePath of resourcePaths) {
            let resource = resources.items?.find(r => r.path === resourcePath);

            if (!resource) {
                console.log(`Creating resource for path: ${resourcePath}`);
                const createResourceParams = {
                    parentId: rootResource.id!,
                    pathPart: resourcePath === '/' ? '' : '{proxy+}',
                    restApiId: api.id!,
                };
                resource = await apiGateway.send(new CreateResourceCommand(createResourceParams));
                console.log(`Resource ${resourcePath} created successfully.`);

                const putMethodParams = {
                    authorizationType: 'NONE',
                    httpMethod: 'ANY',
                    resourceId: resource.id!,
                    restApiId: api.id!,
                };
    
                await apiGateway.send(new PutMethodCommand(putMethodParams));
                console.log(`Method ANY created for resource ${resourcePath}.`);

                // Add a static catch-all OPTIONS method that just returns CORS headers
                const putOptionsMethodParams = {
                    authorizationType: 'NONE',
                    httpMethod: 'OPTIONS',
                    resourceId: resource.id!,
                    restApiId: api.id!,
                    responseParameters: {
                        'method.response.header.Access-Control-Allow-Headers': true,
                        'method.response.header.Access-Control-Allow-Methods': true,
                        'method.response.header.Access-Control-Allow-Origin': true,
                    },
                };

                await apiGateway.send(new PutMethodCommand(putOptionsMethodParams));
                console.log(`OPTIONS method created for resource ${resourcePath}.`);

                const putOptionsIntegrationParams = {
                    httpMethod: 'OPTIONS',
                    resourceId: resource.id!,
                    restApiId: api.id!,
                    type: IntegrationType.MOCK,
                    integrationResponses: [
                        {
                            statusCode: '200',
                            responseParameters: {
                                'method.response.header.Access-Control-Allow-Headers': "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
                                'method.response.header.Access-Control-Allow-Methods': "GET,POST,PUT,DELETE,OPTIONS",
                                'method.response.header.Access-Control-Allow-Origin': "*",
                            },
                        },
                    ],
                };

                await apiGateway.send(new PutIntegrationCommand(putOptionsIntegrationParams));
                console.log(`OPTIONS method integration created for resource ${resourcePath}.`);

                const putOptionsMethodResponseParams = {
                    httpMethod: 'OPTIONS',
                    resourceId: resource.id!,
                    restApiId: api.id!,
                    statusCode: '200',
                };

                await apiGateway.send(new PutMethodResponseCommand(putOptionsMethodResponseParams));
                console.log(`OPTIONS method response created for resource ${resourcePath}.`);

                const apiRegion = await apiGateway.config.region();
                const lambdaRegion = await lambda.config.region();
                const uri = `arn:aws:apigateway:${apiRegion}:lambda:path/2015-03-31/functions/arn:aws:lambda:${lambdaRegion}:${accountId}:function:${FunctionName}/invocations`;
                console.log(`Integration URI: ${uri}`);
                const integrationParams = {
                    httpMethod: putMethodParams.httpMethod,
                    resourceId: resource.id!,
                    restApiId: api.id!,
                    type: IntegrationType.AWS_PROXY,
                    integrationHttpMethod: putMethodParams.httpMethod,
                    uri,
                };
    
                try {
                    await apiGateway.send(new PutIntegrationCommand(integrationParams));
                    console.log(`API Gateway ${gatewayName} connected to Lambda function ${FunctionName} for path ${resourcePath} successfully.`);
                } catch (integrationError:any) {
                    console.error(`Error connecting API Gateway to Lambda function: ${integrationError.message}`);
                }
            } else {
                console.log(`Found existing resource for path: ${resourcePath}`);
            }
        }

        // Create a deployment for the API
        console.log('Creating deployment for the API...');
        const createDeploymentParams = {
            restApiId: api.id!,
            stageName: 'prod',
        };
        await apiGateway.send(new CreateDeploymentCommand(createDeploymentParams));
        console.log(`Deployment created successfully for stage 'prod'.`);

        // Create a custom domain name
        console.log('Creating custom domain name...');
        try {
            const createDomainNameParams = {
                domainName,
                endpointConfiguration: {
                    types: [EndpointType.REGIONAL],
                },
                regionalCertificateArn,
            };
            await apiGateway.send(new CreateDomainNameCommand(createDomainNameParams));
            console.log(`Custom domain name ${domainName} created successfully.`);
        } catch (error: any) {
            if (error.message === 'The domain name you provided already exists.') {
                console.log(`Custom domain name ${domainName} already exists.`);
            } else {
                throw error;
            }
        }

        // Create a base path mapping
        console.log('Creating base path mapping...');
        try {
            const createBasePathMappingParams = {
                domainName,
                restApiId: api.id!,
                stage: 'prod',
            };
            await apiGateway.send(new CreateBasePathMappingCommand(createBasePathMappingParams));
            console.log(`Base path mapping created successfully for domain ${domainName} to stage 'prod'.`);
        } catch (error: any) {
            if (error.name === 'ConflictException') {
                console.log(`Base path mapping for domain ${domainName} already exists.`);
            } else {
                throw error;
            }
        }
    } catch (error:any) {
        console.error(`Error connecting to API Gateway: ${error.message}`);
    }
}
