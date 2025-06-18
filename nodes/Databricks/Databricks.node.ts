import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionTypes,
  IHttpRequestMethods,
} from 'n8n-workflow';
import {
  filesOperations,
  filesParameters,
  genieOperations,
  genieParameters,
  unityCatalogOperations,
  unityCatalogParameters,
  databricksSqlOperations,
  databricksSqlParameters,
  modelServingOperations,
  modelServingParameters,
  vectorSearchOperations,
  vectorSearchParameters,
} from './resources';

interface DatabricksCredentials {
  host: string;
  token: string;
}

export class Databricks implements INodeType {
  description: INodeTypeDescription = {
      displayName: 'Databricks',
      name: 'databricks',
      icon: 'file:databricks.svg',
      group: ['transform'],
      version: 1,
      usableAsTool: true,
      subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
      description: 'Interact with Databricks API',
      defaults: {
          name: 'Databricks',
      },
      inputs: [NodeConnectionTypes.Main],
      outputs: [NodeConnectionTypes.Main],
      credentials: [
          {
              name: 'databricks',
              required: true,
          },
      ],
      requestDefaults: {
          baseURL: '={{$credentials.host}}',
          headers: {
              Authorization: '=Bearer {{$credentials.token}}',
          },
      },
      properties: [
          {
              displayName: 'Resource',
              name: 'resource',
              type: 'options',
              noDataExpression: true,
              options: [
                  { name: 'Genie', value: 'genie' },
                  { name: 'Databricks SQL', value: 'databricksSql' },
                  { name: 'Unity Catalog', value: 'unityCatalog' },
                  { name: 'Model Serving', value: 'modelServing' },
                  { name: 'Files', value: 'files' },
                  { name: 'Vector Search', value: 'vectorSearch' },
              ],
              default: 'databricksSql',
          },
          filesOperations,
          genieOperations,
          unityCatalogOperations,
          databricksSqlOperations,
          modelServingOperations,
          vectorSearchOperations,
          ...filesParameters,
          ...genieParameters,
          ...unityCatalogParameters,
          ...databricksSqlParameters,
          ...modelServingParameters,
          ...vectorSearchParameters,
      ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
      const items = this.getInputData();
      const returnData: INodeExecutionData[] = [];

      this.logger.debug(`Starting execution with ${items.length} items`);

      for (let i = 0; i < items.length; i++) {
          try {
              this.logger.debug(`Processing item ${i + 1}/${items.length}`);
              const resource = this.getNodeParameter('resource', i) as string;
              const operation = this.getNodeParameter('operation', i) as string;

              this.logger.debug('Node parameters', {
                  resource,
                  operation,
                  itemIndex: i
              });

              if (resource === 'files' && operation === 'uploadFile') {
                  const dataFieldName = this.getNodeParameter('dataFieldName', i) as string;
                  const catalog = this.getNodeParameter('catalog', i) as string;
                  const schema = this.getNodeParameter('schema', i) as string;
                  const volume = this.getNodeParameter('volume', i) as string;
                  const path = this.getNodeParameter('path', i) as string;

                  this.logger.debug('File upload parameters', {
                      dataFieldName,
                      catalog,
                      schema,
                      volume,
                      path
                  });

                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host;
                  const binaryData = await this.helpers.getBinaryDataBuffer(i, dataFieldName);

                  this.logger.debug('Starting file upload', {
                      host,
                      path,
                      dataSize: binaryData.length
                  });

                  await this.helpers.httpRequest({
                      method: 'PUT',
                      url: `${host}/api/2.0/fs/files/Volumes/${catalog}/${schema}/${volume}/${path}`,
                      body: binaryData,
                      headers: {
                          Authorization: `Bearer ${credentials.token}`,
                          'Content-Type': items[i].binary?.[dataFieldName]?.mimeType || 'application/octet-stream',
                      },
                      encoding: 'arraybuffer',
                  });

                  this.logger.debug('File upload successful', { path });
                  returnData.push({
                      json: {
                          success: true,
                          message: `File uploaded successfully to ${path}`,
                      },
                  });
              } else if (resource === 'genie') {
                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host;

                  let url: string;
                  let method: IHttpRequestMethods;
                  let body: object | undefined;

                  switch (operation) {
                      case 'createMessage':
                          url = `${host}/api/2.0/genie/spaces/${
                              this.getNodeParameter('spaceId', i) as string
                          }/conversations/${
                              this.getNodeParameter('conversationId', i) as string
                          }/messages`;
                          method = 'POST';
                          body = {
                              content: this.getNodeParameter('message', i) as string,
                          };
                          break;

                      case 'getMessage':
                          url = `${host}/api/2.0/genie/spaces/${
                            this.getNodeParameter('spaceId', i) as string
                        }/conversations/${
                            this.getNodeParameter('conversationId', i) as string
                        }/messages/${
                              this.getNodeParameter('messageId', i) as string
                          }`;
                          method = 'GET';
                          break;

                      case 'getQueryResults':
                          url = `${host}/api/2.0/genie/spaces/${
                            this.getNodeParameter('spaceId', i) as string
                        }/conversations/${
                            this.getNodeParameter('conversationId', i) as string
                        }/messages/${
                            this.getNodeParameter('messageId', i) as string
                        }/attachments/${
                            this.getNodeParameter('attachmentId', i) as string
                        }/query-result`;
                          method = 'GET';
                          break;

                      case 'executeMessageQuery':
                          url = `${host}/api/2.0/genie/spaces/${
                            this.getNodeParameter('spaceId', i) as string
                        }/conversations/${
                            this.getNodeParameter('conversationId', i) as string
                        }/messages/${
                            this.getNodeParameter('messageId', i) as string
                        }/attachments/${
                            this.getNodeParameter('attachmentId', i) as string
                        }/execute-query`;
                          method = 'POST';
                          break;

                      case 'getSpace':
                          url = `${host}/api/2.0/genie/spaces/${
                            this.getNodeParameter('spaceId', i) as string
                          }`;
                          method = 'GET';
                          break;

                      case 'startConversation':
                        const spaceId = this.getNodeParameter('spaceId', i) as string;
                        url = `${host}/api/2.0/genie/spaces/${spaceId}/start-conversation`;
                          method = 'POST';
                          body = {
                            content: this.getNodeParameter('initialMessage', i) as string,
                          };
                          break;

                      default:
                          throw new Error(`Unsupported Genie operation: ${operation}`);
                  }

                  this.logger.debug('Making Genie API request', {
                      url,
                      method,
                      body: JSON.stringify(body, null, 2)
                  });

                  const response = await this.helpers.httpRequest({
                      method,
                      url,
                      body,
                      headers: {
                          Authorization: `Bearer ${credentials.token}`,
                          'Content-Type': 'application/json',
                      },
                      json: true,
                  });

                  this.logger.debug('Genie API response received', {
                      statusCode: response.statusCode,
                      response: JSON.stringify(response, null, 2)
                  });

                  returnData.push({ json: response });
              } else {
                  this.logger.debug('Passing through unhandled resource', { resource });
                  returnData.push({
                      json: items[i].json,
                  });
              }
          } catch (error) {
              const currentResource = this.getNodeParameter('resource', i) as string;
              const currentOperation = this.getNodeParameter('operation', i) as string;
              
              this.logger.error(`Error processing item ${i + 1}`, {
                  error: error.message,
                  stack: error.stack,
                  itemIndex: i,
                  resource: currentResource,
                  operation: currentOperation
              });

              if (error.response) {
                  // API Error
                  this.logger.error('API Error', {
                      status: error.response.status,
                      statusText: error.response.statusText,
                      data: error.response.data
                  });
                  if (this.continueOnFail()) {
                      returnData.push({ 
                          json: { 
                              error: `API Error: ${error.response.status} ${error.response.statusText}`,
                              details: error.response.data
                          } 
                      });
                  } else {
                      throw new Error(`API Error: ${error.response.status} ${error.response.statusText}`);
                  }
              } else if (error.request) {
                  // Network Error
                  this.logger.error('Network Error', {
                      request: error.request
                  });
                  if (this.continueOnFail()) {
                      returnData.push({ 
                          json: { 
                              error: 'Network Error: No response received from server',
                              details: error.message
                          } 
                      });
                  } else {
                      throw new Error('Network Error: No response received from server');
                  }
              } else {
                  // Other Error
                  if (this.continueOnFail()) {
                      returnData.push({ 
                          json: { 
                              error: error.message,
                              details: error.stack
                          } 
                      });
                  } else {
                      throw error;
                  }
              }
          }
      }

      this.logger.debug('Execution completed successfully');
      return [returnData];
  }
}
