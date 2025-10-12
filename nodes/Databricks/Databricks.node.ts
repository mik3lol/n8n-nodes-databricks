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

interface CacheEntry {
  data: any;
  timestamp: number;
}

// In-memory caches for dropdown options
const endpointCache: Map<string, CacheEntry> = new Map();
const warehouseCache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper function to get cache key (includes host to handle multiple accounts)
function getCacheKey(host: string, type: 'warehouses' | 'endpoints'): string {
	return `${host}:${type}`;
}

// Helper function to check if cache is valid
function isCacheValid(entry: CacheEntry | undefined): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
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

interface OpenAPISchema {
  servers?: Array<{
    url: string;
  }>;
  paths: {
    [path: string]: {
      post?: {
        requestBody?: {
          content?: {
            'application/json'?: {
              schema?: {
                oneOf?: Array<{
                  type: string;
                  properties: any;
                }>;
                properties?: any;
              };
            };
          };
        };
      };
    };
  };
}

// Helper function to detect input format and extract invocation URL from OpenAPI schema
function detectInputFormat(openApiSchema: OpenAPISchema): {
  format: string;
  schema: any;
  requiredFields: string[];
  invocationUrl: string;
} {
  // The server URL is the actual invocation endpoint
  const invocationUrl = openApiSchema.servers?.[0]?.url;
  if (!invocationUrl) {
    throw new Error('No server URL found in OpenAPI schema');
  }

  const pathKeys = Object.keys(openApiSchema.paths);
  if (!pathKeys.length) {
    throw new Error('No paths found in OpenAPI schema');
  }
  
  // Get the first POST path to extract the schema (not for the URL)
  const invocationPath = pathKeys[0];
  const postOperation = openApiSchema.paths[invocationPath]?.post;
  
  if (!postOperation?.requestBody?.content?.['application/json']?.schema) {
    throw new Error('No request schema found');
  }

  const schema = postOperation.requestBody.content['application/json'].schema;
  
  // Check if schema has oneOf (multiple format options)
  if (schema.oneOf && schema.oneOf.length > 0) {
    // Find the first supported format
    for (const option of schema.oneOf) {
      const properties = option.properties || {};
      
      // Check for different formats in priority order
      if (properties.messages) {
        return { format: 'chat', schema: properties.messages, requiredFields: ['messages'], invocationUrl };
      }
      if (properties.prompt) {
        return { format: 'completions', schema: properties.prompt, requiredFields: ['prompt'], invocationUrl };
      }
      if (properties.input && !properties.dataframe_records && !properties.dataframe_split) {
        return { format: 'embeddings', schema: properties.input, requiredFields: ['input'], invocationUrl };
      }
      if (properties.dataframe_split) {
        return {
          format: 'dataframe_split',
          schema: properties.dataframe_split,
          requiredFields: ['dataframe_split'],
          invocationUrl,
        };
      }
      if (properties.dataframe_records) {
        return { format: 'dataframe_records', schema: properties.dataframe_records, requiredFields: ['dataframe_records'], invocationUrl };
      }
      if (properties.inputs) {
        return { format: 'inputs', schema: properties.inputs, requiredFields: ['inputs'], invocationUrl };
      }
      if (properties.instances) {
        return { format: 'instances', schema: properties.instances, requiredFields: ['instances'], invocationUrl };
      }
    }
  }
  
  // Fallback: check direct properties
  const properties = schema.properties || {};
  if (properties.messages) return { format: 'chat', schema: properties.messages, requiredFields: ['messages'], invocationUrl };
  if (properties.prompt) return { format: 'completions', schema: properties.prompt, requiredFields: ['prompt'], invocationUrl };
  if (properties.input) return { format: 'embeddings', schema: properties.input, requiredFields: ['input'], invocationUrl };
  if (properties.dataframe_records) return { format: 'dataframe_records', schema: properties.dataframe_records, requiredFields: ['dataframe_records'], invocationUrl };
  if (properties.dataframe_split) return { format: 'dataframe_split', schema: properties.dataframe_split, requiredFields: ['dataframe_split'], invocationUrl };
  if (properties.inputs) return { format: 'inputs', schema: properties.inputs, requiredFields: ['inputs'], invocationUrl };
  if (properties.instances) return { format: 'instances', schema: properties.instances, requiredFields: ['instances'], invocationUrl };
  
  // Default to generic JSON
  return { format: 'generic', schema: schema, requiredFields: [], invocationUrl };
}

// Helper function to generate example request body from schema
function generateExampleFromSchema(schema: any, format: string): string {
  // Try to generate a specific example from the actual schema properties
  if (schema && schema.properties) {
    try {
      const exampleObj: any = {};
      
      // Generate example for each property based on its type
      for (const [key, propValue] of Object.entries(schema.properties as any)) {
        const prop = propValue as any;
        const propType = prop.type;
        
        if (key === 'messages' && propType === 'array') {
          exampleObj.messages = [
            { role: 'user', content: 'Hello! How can you help me today?' }
          ];
        } else if (key === 'prompt' && propType === 'string') {
          exampleObj.prompt = 'What is Databricks?';
        } else if (key === 'input' && propType === 'array') {
          exampleObj.input = ['Text to embed'];
        } else if (key === 'max_tokens' && propType === 'integer') {
          exampleObj.max_tokens = 256;
        } else if (key === 'temperature' && propType === 'number') {
          exampleObj.temperature = 0.7;
        } else if (key === 'top_p' && propType === 'number') {
          exampleObj.top_p = 0.9;
        } else if (key === 'top_k' && propType === 'integer') {
          exampleObj.top_k = 40;
        } else if (key === 'stream' && propType === 'boolean') {
          exampleObj.stream = false;
        } else if (key === 'n' && propType === 'integer') {
          exampleObj.n = 1;
        } else if (key === 'stop' && prop.oneOf) {
          exampleObj.stop = ['\\n'];
        }
      }
      
      if (Object.keys(exampleObj).length > 0) {
        return JSON.stringify(exampleObj, null, 2);
      }
    } catch (e) {
      // Fall through to default examples
    }
  }
  
  // Default examples by format
  const examples: { [key: string]: string } = {
    chat: `{
  "messages": [
    {
      "role": "user",
      "content": "Hello! How are you?"
    }
  ],
  "max_tokens": 256,
  "temperature": 0.7
}`,
    completions: `{
  "prompt": "What is machine learning?",
  "max_tokens": 256,
  "temperature": 0.7,
  "top_p": 0.9
}`,
    embeddings: `{
  "input": [
    "Example text to embed"
  ]
}`,
    dataframe_split: `{
  "dataframe_split": {
    "columns": ["feature1", "feature2"],
    "data": [[1.0, 2.0], [3.0, 4.0]]
  }
}`,
    dataframe_records: `{
  "dataframe_records": [
    {"feature1": 1.0, "feature2": 2.0}
  ]
}`,
    inputs: `{
  "inputs": {
    "tensor1": [1, 2, 3]
  }
}`,
    instances: `{
  "instances": [
    {"tensor1": 1}
  ]
}`,
  };
  
  return examples[format] || '{}';
}

// Helper function to validate request body
function validateRequestBody(requestBody: any, detectedFormat: string): void {
  // Basic validation based on detected format
  switch (detectedFormat) {
    case 'chat':
      if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
        throw new Error('Invalid chat format: "messages" array is required');
      }
      break;
    case 'completions':
      if (!requestBody.prompt) {
        throw new Error('Invalid completions format: "prompt" is required');
      }
      break;
    case 'embeddings':
      if (!requestBody.input) {
        throw new Error('Invalid embeddings format: "input" is required');
      }
      break;
    case 'dataframe_split':
      if (!requestBody.dataframe_split || !requestBody.dataframe_split.data) {
        throw new Error('Invalid dataframe_split format: "dataframe_split.data" is required');
      }
      break;
    case 'dataframe_records':
      if (!requestBody.dataframe_records || !Array.isArray(requestBody.dataframe_records)) {
        throw new Error('Invalid dataframe_records format: "dataframe_records" array is required');
      }
      break;
    case 'inputs':
      if (!requestBody.inputs) {
        throw new Error('Invalid inputs format: "inputs" is required');
      }
      break;
    case 'instances':
      if (!requestBody.instances || !Array.isArray(requestBody.instances)) {
        throw new Error('Invalid instances format: "instances" array is required');
      }
      break;
  }
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
            async getWarehouses(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
                const credentials = await this.getCredentials('databricks') as DatabricksCredentials;
                const host = credentials.host.replace(/\/$/, '');
                const cacheKey = getCacheKey(host, 'warehouses');
                
                // Check cache first
                let warehouses: Array<{ id: string; name: string; size?: string }> = [];
                const cachedEntry = warehouseCache.get(cacheKey);
                
                if (isCacheValid(cachedEntry)) {
                    // Use cached data - no API call needed!
                    warehouses = cachedEntry!.data;
                } else {
                    // Fetch from API
                    const response = await this.helpers.httpRequest({
                        method: 'GET',
                        url: `${host}/api/2.0/sql/warehouses`,
                        headers: {
                            Authorization: `Bearer ${credentials.token}`,
                            'Accept': 'application/json',
                        },
                        json: true,
                    }) as { warehouses?: Array<{ id: string; name: string; size?: string }> };

                    warehouses = response.warehouses ?? [];
                    
                    // Store in cache
                    warehouseCache.set(cacheKey, {
                        data: warehouses,
                        timestamp: Date.now(),
                    });
                }

                const allResults = warehouses.map((warehouse) => ({
                    name: warehouse.name,
                    value: warehouse.id,
                    url: `${host}/sql/warehouses/${warehouse.id}`,
                }));

                // Apply client-side filter
                if (filter) {
                    const filterLower = filter.toLowerCase();
                    const filteredResults = allResults.filter((result) =>
                        result.name.toLowerCase().includes(filterLower)
                    );
                    return { results: filteredResults };
                }

                return { results: allResults };
            },
            async getEndpoints(this: ILoadOptionsFunctions, filter?: string): Promise<INodeListSearchResult> {
                const credentials = await this.getCredentials('databricks') as DatabricksCredentials;
                const host = credentials.host.replace(/\/$/, '');
                const cacheKey = getCacheKey(host, 'endpoints');
                
                // Check cache first
                let endpoints: Array<{ name: string; config?: any }> = [];
                const cachedEntry = endpointCache.get(cacheKey);
                
                if (isCacheValid(cachedEntry)) {
                    // Use cached data - no API call needed!
                    endpoints = cachedEntry!.data;
                } else {
                    // Fetch from API
                    const response = await this.helpers.httpRequest({
                        method: 'GET',
                        url: `${host}/api/2.0/serving-endpoints`,
                        headers: {
                            Authorization: `Bearer ${credentials.token}`,
                            'Accept': 'application/json',
                        },
                        json: true,
                    }) as { endpoints?: Array<{ name: string; config?: any }> };

                    endpoints = response.endpoints ?? [];
                    
                    // Store in cache
                    endpointCache.set(cacheKey, {
                        data: endpoints,
                        timestamp: Date.now(),
                    });
                }

                const allResults = endpoints.map((endpoint) => {
                    // Extract model names from served entities for the description
                    const modelNames = (endpoint.config?.served_entities || [])
                        .map((entity: any) => entity.external_model?.name || entity.foundation_model?.name)
                        .filter(Boolean)
                        .join(', ');
                    
                    return {
                        name: endpoint.name,
                        value: endpoint.name,
                        url: `${host}/serving-endpoints/${endpoint.name}`,
                        description: modelNames || 'Model serving endpoint',
                    };
                });

                // Apply client-side filter - search both name and description
                if (filter) {
                    const filterLower = filter.toLowerCase();
                    const filteredResults = allResults.filter((result) => {
                        return (
                            result.name.toLowerCase().includes(filterLower) ||
                            (result.description && result.description.toLowerCase().includes(filterLower))
                        );
                    });
                    return { results: filteredResults };
                }

                return { results: allResults };
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
                  const volumePath = this.getNodeParameter('volumePath', i) as string;
                  const filePath = this.getNodeParameter('filePath', i) as string;

                  // Parse volume path
                  const parts = volumePath.split('.');
                  if (parts.length !== 3) {
                      throw new Error('Volume path must be in format: catalog.schema.volume (e.g., main.default.my_volume)');
                  }
                  const [catalog, schema, volume] = parts;

                  this.logger.debug('File upload parameters', {
                      dataFieldName,
                      volumePath,
                      catalog,
                      schema,
                      volume,
                      filePath
                  });

                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host;
                  const binaryData = await this.helpers.getBinaryDataBuffer(i, dataFieldName);

                  this.logger.debug('Starting file upload', {
                      host,
                      filePath,
                      dataSize: binaryData.length
                  });

                  await this.helpers.httpRequest({
                      method: 'PUT',
                      url: `${host}/api/2.0/fs/files/Volumes/${catalog}/${schema}/${volume}/${filePath}`,
                      body: binaryData,
                      headers: {
                          Authorization: `Bearer ${credentials.token}`,
                          'Content-Type': items[i].binary?.[dataFieldName]?.mimeType || 'application/octet-stream',
                      },
                      encoding: 'arraybuffer',
                  });

                  this.logger.debug('File upload successful', { filePath });
                  returnData.push({
                      json: {
                          success: true,
                          message: `File uploaded successfully to ${filePath}`,
                      },
                  });
              } else if (resource === 'files' && operation === 'downloadFile') {
                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host.replace(/\/$/, '');
                  const volumePath = this.getNodeParameter('volumePath', i) as string;
                  const filePath = this.getNodeParameter('filePath', i) as string;

                  // Parse volume path
                  const parts = volumePath.split('.');
                  if (parts.length !== 3) {
                      throw new Error('Volume path must be in format: catalog.schema.volume (e.g., main.default.my_volume)');
                  }
                  const [catalog, schema, volume] = parts;

                  this.logger.debug('Downloading file', {
                      volumePath,
                      catalog,
                      schema,
                      volume,
                      filePath,
                  });

                  const downloadUrl = `${host}/api/2.0/fs/files/Volumes/${catalog}/${schema}/${volume}/${filePath}`;

                  try {
                      const response = await this.helpers.httpRequest({
                          method: 'GET',
                          url: downloadUrl,
                          headers: {
                              Authorization: `Bearer ${credentials.token}`,
                          },
                          encoding: 'arraybuffer',
                          returnFullResponse: true,
                      });

                      // Extract filename from filePath
                      const fileName = filePath.split('/').pop() || 'downloaded-file';
                      
                      // Get content type from response headers
                      const contentType = response.headers['content-type'] || 'application/octet-stream';

                      // Convert arraybuffer to buffer
                      const buffer = Buffer.from(response.body as ArrayBuffer);

                      this.logger.debug('File downloaded successfully', {
                          fileName,
                          size: buffer.length,
                          contentType,
                      });

                      returnData.push({
                          json: {
                              fileName,
                              size: buffer.length,
                              contentType,
                              catalog,
                              schema,
                              volume,
                              filePath,
                          },
                          binary: {
                              data: {
                                  data: buffer.toString('base64'),
                                  mimeType: contentType,
                                  fileName,
                              },
                          },
                          pairedItem: { item: i },
                      });
                  } catch (error) {
                      if (this.continueOnFail()) {
                          returnData.push({
                              json: {
                                  error: error.message,
                                  catalog,
                                  schema,
                                  volume,
                                  filePath,
                              },
                              pairedItem: { item: i },
                          });
                      } else {
                          throw error;
                      }
                  }
              } else if (resource === 'files' && operation === 'deleteFile') {
                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host.replace(/\/$/, '');
                  const volumePath = this.getNodeParameter('volumePath', i) as string;
                  const filePath = this.getNodeParameter('filePath', i) as string;

                  // Parse volume path
                  const parts = volumePath.split('.');
                  if (parts.length !== 3) {
                      throw new Error('Volume path must be in format: catalog.schema.volume (e.g., main.default.my_volume)');
                  }
                  const [catalog, schema, volume] = parts;

                  await this.helpers.httpRequest({
                      method: 'DELETE',
                      url: `${host}/api/2.0/fs/files/Volumes/${catalog}/${schema}/${volume}/${filePath}`,
                      headers: {
                          Authorization: `Bearer ${credentials.token}`,
                      },
                      json: true,
                  });

                  returnData.push({
                      json: {
                          success: true,
                          message: `File deleted successfully: ${filePath}`,
                          volumePath,
                          filePath,
                      },
                      pairedItem: { item: i },
                  });
              } else if (resource === 'files' && operation === 'getFileInfo') {
                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host.replace(/\/$/, '');
                  const volumePath = this.getNodeParameter('volumePath', i) as string;
                  const filePath = this.getNodeParameter('filePath', i) as string;

                  // Parse volume path
                  const parts = volumePath.split('.');
                  if (parts.length !== 3) {
                      throw new Error('Volume path must be in format: catalog.schema.volume (e.g., main.default.my_volume)');
                  }
                  const [catalog, schema, volume] = parts;

                  const response = await this.helpers.httpRequest({
                      method: 'HEAD',
                      url: `${host}/api/2.0/fs/files/Volumes/${catalog}/${schema}/${volume}/${filePath}`,
                      headers: {
                          Authorization: `Bearer ${credentials.token}`,
                      },
                      returnFullResponse: true,
                  });

                  returnData.push({
                      json: {
                          volumePath,
                          filePath,
                          headers: response.headers,
                          contentLength: response.headers['content-length'],
                          contentType: response.headers['content-type'],
                          lastModified: response.headers['last-modified'],
                      },
                      pairedItem: { item: i },
                  });
              } else if (resource === 'files' && operation === 'listDirectory') {
                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host.replace(/\/$/, '');
                  const volumePath = this.getNodeParameter('volumePath', i) as string;
                  const directoryPath = this.getNodeParameter('directoryPath', i) as string;
                  const additionalFields = this.getNodeParameter('additionalFields', i, {}) as any;

                  // Parse volume path
                  const parts = volumePath.split('.');
                  if (parts.length !== 3) {
                      throw new Error('Volume path must be in format: catalog.schema.volume (e.g., main.default.my_volume)');
                  }
                  const [catalog, schema, volume] = parts;

                  const queryParams: any = {};
                  if (additionalFields.pageSize) {
                      queryParams.page_size = additionalFields.pageSize;
                  }
                  if (additionalFields.pageToken) {
                      queryParams.page_token = additionalFields.pageToken;
                  }

                  const response = await this.helpers.httpRequest({
                      method: 'GET',
                      url: `${host}/api/2.0/fs/directories/Volumes/${catalog}/${schema}/${volume}/${directoryPath}`,
                      headers: {
                          Authorization: `Bearer ${credentials.token}`,
                      },
                      qs: queryParams,
                      json: true,
                  });

                  returnData.push({
                      json: response,
                      pairedItem: { item: i },
                  });
              } else if (resource === 'files' && operation === 'createDirectory') {
                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host.replace(/\/$/, '');
                  const volumePath = this.getNodeParameter('volumePath', i) as string;
                  const directoryPath = this.getNodeParameter('directoryPath', i) as string;

                  // Parse volume path
                  const parts = volumePath.split('.');
                  if (parts.length !== 3) {
                      throw new Error('Volume path must be in format: catalog.schema.volume (e.g., main.default.my_volume)');
                  }
                  const [catalog, schema, volume] = parts;

                  await this.helpers.httpRequest({
                      method: 'PUT',
                      url: `${host}/api/2.0/fs/directories/Volumes/${catalog}/${schema}/${volume}/${directoryPath}`,
                      headers: {
                          Authorization: `Bearer ${credentials.token}`,
                      },
                      json: true,
                  });

                  returnData.push({
                      json: {
                          success: true,
                          message: `Directory created successfully: ${directoryPath}`,
                          volumePath,
                          directoryPath,
                      },
                      pairedItem: { item: i },
                  });
              } else if (resource === 'files' && operation === 'deleteDirectory') {
                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host.replace(/\/$/, '');
                  const volumePath = this.getNodeParameter('volumePath', i) as string;
                  const directoryPath = this.getNodeParameter('directoryPath', i) as string;

                  // Parse volume path
                  const parts = volumePath.split('.');
                  if (parts.length !== 3) {
                      throw new Error('Volume path must be in format: catalog.schema.volume (e.g., main.default.my_volume)');
                  }
                  const [catalog, schema, volume] = parts;

                  await this.helpers.httpRequest({
                      method: 'DELETE',
                      url: `${host}/api/2.0/fs/directories/Volumes/${catalog}/${schema}/${volume}/${directoryPath}`,
                      headers: {
                          Authorization: `Bearer ${credentials.token}`,
                      },
                      json: true,
                  });

                  returnData.push({
                      json: {
                          success: true,
                          message: `Directory deleted successfully: ${directoryPath}`,
                          volumePath,
                          directoryPath,
                      },
                      pairedItem: { item: i },
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
              } else if (resource === 'modelServing' && operation === 'queryEndpoint') {
                  const credentials = (await this.getCredentials('databricks')) as DatabricksCredentials;
                  const host = credentials.host.replace(/\/$/, '');
                  const endpointName = this.getNodeParameter('endpointName', i, '', { extractValue: true }) as string;
                  const requestBody = this.getNodeParameter('requestBody', i) as any;

                  this.logger.debug('Fetching endpoint schema for auto-detection', { endpointName });

                  // Step 1: Fetch the OpenAPI schema for this endpoint
                  let detectedFormat = 'generic';
                  let invocationUrl = `${host}/serving-endpoints/${endpointName}/invocations`; // Default fallback
                  let exampleRequestBody = '';
                  
                  try {
                      const openApiResponse = await this.helpers.httpRequest({
                          method: 'GET',
                          url: `${host}/api/2.0/serving-endpoints/${endpointName}/openapi`,
                          headers: {
                              Authorization: `Bearer ${credentials.token}`,
                              'Accept': 'application/json',
                          },
                          json: true,
                      }) as OpenAPISchema[];

                      if (openApiResponse && openApiResponse.length > 0) {
                          const schemaInfo = detectInputFormat(openApiResponse[0]);
                          detectedFormat = schemaInfo.format;
                          invocationUrl = schemaInfo.invocationUrl; // Use the URL from schema
                          
                          // Generate example request body from schema
                          exampleRequestBody = generateExampleFromSchema(schemaInfo.schema, detectedFormat);
                          
                          this.logger.debug('Auto-detected input format and URL', {
                              endpointName,
                              format: detectedFormat,
                              requiredFields: schemaInfo.requiredFields,
                              invocationUrl,
                              exampleRequestBody,
                          });

                          // Validate the request body against detected schema
                          try {
                              validateRequestBody(requestBody, detectedFormat);
                          } catch (validationError) {
                              // Provide helpful error with example
                              throw new Error(
                                  `${validationError.message}\n\n` +
                                  `Detected format: ${detectedFormat}\n\n` +
                                  `Example request body:\n${exampleRequestBody}\n\n` +
                                  `Your request body:\n${JSON.stringify(requestBody, null, 2)}`
                              );
                          }
                          
                          this.logger.debug('Request body validated successfully', {
                              endpointName,
                              format: detectedFormat,
                          });
                      }
                  } catch (error) {
                      // If it's a validation error with example, re-throw it
                      if (error.message && error.message.includes('Detected format:')) {
                          throw error;
                      }
                      
                      this.logger.warn('Could not fetch or parse endpoint schema, using default URL', {
                          endpointName,
                          error: error.message,
                          defaultUrl: invocationUrl,
                      });
                      
                      // Generate a default example even if schema fetch failed
                      if (!exampleRequestBody) {
                          exampleRequestBody = generateExampleFromSchema(null, detectedFormat);
                      }
                      // Continue with default URL if schema fetch fails
                  }

                  this.logger.debug('Querying model serving endpoint', {
                      endpointName,
                      detectedFormat,
                      invocationUrl,
                      requestBody: JSON.stringify(requestBody, null, 2),
                  });

                  // Step 2: Make the request using the URL from schema
                  try {
                      const response = await this.helpers.httpRequest({
                          method: 'POST',
                          url: invocationUrl,
                          body: requestBody,
                          headers: {
                              Authorization: `Bearer ${credentials.token}`,
                              'Content-Type': 'application/json',
                          },
                          json: true,
                      });

                      this.logger.debug('Model serving response received', {
                          endpointName,
                          detectedFormat,
                          invocationUrl,
                      });

                      returnData.push({ 
                          json: { 
                              ...response,
                              _metadata: {
                                  endpoint: endpointName,
                                  detectedFormat,
                                  invocationUrl,
                              }
                          }, 
                          pairedItem: { item: i } 
                      });
                  } catch (apiError) {
                      // Enhance API errors with example request body
                      if (apiError.statusCode === 400) {
                          // Ensure we have an example to show
                          if (!exampleRequestBody) {
                              exampleRequestBody = generateExampleFromSchema(null, detectedFormat);
                          }
                          
                          const errorDetails = apiError.response?.body || apiError.message || 'Bad Request';
                          throw new Error(
                              `API Error: 400 Bad Request\n\n` +
                              `The endpoint rejected your request. This usually means the request body format is incorrect.\n\n` +
                              `Error details: ${JSON.stringify(errorDetails, null, 2)}\n\n` +
                              `Detected format: ${detectedFormat}\n\n` +
                              `Expected request body format:\n${exampleRequestBody}\n\n` +
                              `Your request body:\n${JSON.stringify(requestBody, null, 2)}`
                          );
                      }
                      throw apiError;
                  }
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