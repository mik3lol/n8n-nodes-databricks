import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeConnectionTypes,
  IHttpRequestMethods,
  ILoadOptionsFunctions,
  INodeListSearchResult,
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

interface DatabricksStatementResponse {
  statement_id: string;
  status: {
    state: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
    error?: {
      error_code: string;
      message: string;
    };
  };
  manifest?: {
    total_chunk_count?: number;
    schema?: {
      columns: Array<{ name: string; type: string }>;
    };
  };
  result?: {
    data_array?: any[][];
  };
}

export class Databricks implements INodeType {
  description: INodeTypeDescription = {
      displayName: 'Databricks',
      name: 'databricks',
      icon: 'file:databricks.svg',
      group: ['transform'],
      version: 1,
      usableAsTool: true,
    //   subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
      subtitle: '',
      description: 'Interact with Databricks API',
      documentationUrl: 'https://docs.databricks.com/aws/en',
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
                  { 
                      name: 'Genie', 
                      value: 'genie',
                      description: 'AI-powered data assistant. <a href="https://docs.databricks.com/genie/index.html" target="_blank">Learn more</a>',
                  },
                  { 
                      name: 'Databricks SQL', 
                      value: 'databricksSql',
                      description: 'Execute SQL queries on data warehouses. <a href="https://docs.databricks.com/sql/index.html" target="_blank">Learn more</a>',
                  },
                  { 
                      name: 'Unity Catalog', 
                      value: 'unityCatalog',
                      description: 'Unified governance for data and AI. <a href="https://docs.databricks.com/data-governance/unity-catalog/index.html" target="_blank">Learn more</a>',
                  },
                  { 
                      name: 'Model Serving', 
                      value: 'modelServing',
                      description: 'Deploy and query ML models. <a href="https://docs.databricks.com/machine-learning/model-serving/index.html" target="_blank">Learn more</a>',
                  },
                  { 
                      name: 'Files', 
                      value: 'files',
                      description: 'Manage files in Unity Catalog volumes. <a href="https://docs.databricks.com/api/workspace/files" target="_blank">Learn more</a>',
                  },
                  { 
                      name: 'Vector Search', 
                      value: 'vectorSearch',
                      description: 'Semantic search with vector embeddings. <a href="https://docs.databricks.com/generative-ai/vector-search.html" target="_blank">Learn more</a>',
                  },
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

  methods = {
        listSearch: {
            async getWarehouses(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
                const credentials = await this.getCredentials('databricks') as DatabricksCredentials;
                const host = credentials.host.replace(/\/$/, '');
                
                const response = await this.helpers.httpRequest({
                    method: 'GET',
                    url: `${host}/api/2.0/sql/warehouses`,
                    headers: {
                        Authorization: `Bearer ${credentials.token}`,
                        'Accept': 'application/json',
                    },
                    json: true,
                }) as { warehouses?: Array<{ id: string; name: string; size?: string }> };

                const warehouses = response.warehouses ?? [];

                const results = warehouses.map((warehouse) => ({
                    name: warehouse.name,
                    value: warehouse.id,
                    url: `${host}/sql/warehouses/${warehouse.id}`,
                }));

                return { results };
            },
        },
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
              } else if (resource === 'databricksSql' && operation === 'executeQuery') {
                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host.replace(/\/$/, '');
                  const warehouseId = this.getNodeParameter('warehouseId', i) as { mode: string; value: string };
                  const query = this.getNodeParameter('query', i) as string;

                  this.logger.debug('Executing SQL query', {
                      warehouseId: warehouseId.value,
                      query: query.substring(0, 100), // Log first 100 chars
                  });

                  // Step 1: Execute the query
                  const executeResponse = await this.helpers.httpRequest({
                      method: 'POST',
                      url: `${host}/api/2.0/sql/statements`,
                      body: {
                          warehouse_id: warehouseId.value,
                          statement: query,
                      },
                      headers: {
                          Authorization: `Bearer ${credentials.token}`,
                          'Content-Type': 'application/json',
                      },
                      json: true,
                  }) as DatabricksStatementResponse;

                  const statementId = executeResponse.statement_id;
                  this.logger.debug('Query submitted', { statementId });

                  // Step 2: Poll for completion
                  let status = executeResponse.status.state;
                  let queryResult = executeResponse;
                  const maxRetries = 60; // Max 5 minutes (60 * 5 seconds)
                  let retries = 0;

                  while (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'CANCELED' && retries < maxRetries) {
                      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                      
                      queryResult = await this.helpers.httpRequest({
                          method: 'GET',
                          url: `${host}/api/2.0/sql/statements/${statementId}`,
                          headers: {
                              Authorization: `Bearer ${credentials.token}`,
                              'Accept': 'application/json',
                          },
                          json: true,
                      }) as DatabricksStatementResponse;

                      status = queryResult.status.state;
                      retries++;
                      
                      this.logger.debug('Polling query status', {
                          statementId,
                          status,
                          attempt: retries,
                      });
                  }

                  if (status === 'FAILED' || status === 'CANCELED') {
                      throw new Error(`Query ${status.toLowerCase()}: ${JSON.stringify(queryResult.status)}`);
                  }

                  if (retries >= maxRetries) {
                      throw new Error('Query execution timeout - exceeded maximum wait time');
                  }

                  // Step 3: Collect all chunks
                  const allRows: any[] = [];
                  let chunkIndex = 0;
                  const totalChunks = queryResult.manifest?.total_chunk_count || 0;

                  this.logger.debug('Starting chunk collection', {
                      statementId,
                      totalChunks,
                  });

                  // First chunk might be in the initial response
                  if (queryResult.result?.data_array) {
                      allRows.push(...queryResult.result.data_array);
                      chunkIndex = 1;
                  }

                  // Fetch remaining chunks
                  while (chunkIndex < totalChunks) {
                      const chunkResponse = await this.helpers.httpRequest({
                          method: 'GET',
                          url: `${host}/api/2.0/sql/statements/${statementId}/result/chunks/${chunkIndex}`,
                          headers: {
                              Authorization: `Bearer ${credentials.token}`,
                              'Accept': 'application/json',
                          },
                          json: true,
                      }) as { data_array?: any[][] };

                      if (chunkResponse.data_array) {
                          allRows.push(...chunkResponse.data_array);
                      }

                      chunkIndex++;
                      
                      this.logger.debug('Fetched chunk', {
                          statementId,
                          chunkIndex,
                          totalChunks,
                          rowsCollected: allRows.length,
                      });
                  }

                  // Step 4: Transform rows into objects using column names
                  const columns = queryResult.manifest?.schema?.columns || [];
                  const formattedResults = allRows.map(row => {
                      const obj: any = {};
                      columns.forEach((col: any, idx: number) => {
                          obj[col.name] = row[idx];
                      });
                      return obj;
                  });

                  this.logger.debug('Query execution complete', {
                      statementId,
                      totalRows: formattedResults.length,
                      totalChunks,
                  });

                  // Return each row as a separate item (n8n convention)
                  formattedResults.forEach(row => {
                      returnData.push({
                          json: row,
                          pairedItem: { item: i },
                      });
                  });
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