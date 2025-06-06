import type { INodeProperties } from 'n8n-workflow';

export const filesOperations: INodeProperties = {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
        show: {
            resource: ['files'],
        },
    },
    options: [
        {
            name: 'Upload File',
            value: 'uploadFile',
            description: 'Upload a file to Databricks workspace',
            action: 'Upload a file',
            routing: {
                request: {
                    method: 'PUT',
                    url: '=/api/2.0/fs/files/Volumes/{{$parameter.catalog}}/{{$parameter.schema}}/{{$parameter.volume}}{{$parameter.path}}',
                    body: '={{$binary[$parameter.binaryPropertyName].data}}',
                    headers: {
                        'Content-Type': '={{$parameter.contentType}}',
                    },
                    qs: {
                        overwrite: '={{$parameter.additionalFields?.overwrite}}',
                    },
                    encoding: 'stream',
                },
            },
        },
        {
            name: 'Download File',
            value: 'downloadFile',
            description: 'Download file content from Databricks workspace',
            action: 'Download a file',
            routing: {
                request: {
                    method: 'GET',
                    url: '=/api/2.0/fs/files/Volumes/{{$parameter.catalog}}/{{$parameter.schema}}/{{$parameter.volume}}{{$parameter.path}}',
                },
            },
        },
        {
            name: 'Delete File',
            value: 'deleteFile',
            description: 'Delete a file from Databricks workspace',
            action: 'Delete a file',
            routing: {
                request: {
                    method: 'DELETE',
                    url: '=/api/2.0/fs/files/Volumes/{{$parameter.catalog}}/{{$parameter.schema}}/{{$parameter.volume}}{{$parameter.path}}',
                },
            },
        },
        {
            name: 'Get File Metadata',
            value: 'getFileInfo',
            description: 'Get file metadata from Databricks workspace',
            action: 'Get file info',
            routing: {
                request: {
                    method: 'HEAD',
                    url: '=/api/2.0/fs/files/Volumes/{{$parameter.catalog}}/{{$parameter.schema}}/{{$parameter.volume}}{{$parameter.path}}',
                },
            },
        },
        {
            name: 'List Directory',
            value: 'listDirectory',
            description: 'List directory contents in volume',
            action: 'List a directory',
            routing: {
                request: {
                    method: 'GET',
                    url: '=/api/2.0/fs/directories/Volumes/{{$parameter.catalog}}/{{$parameter.schema}}/{{$parameter.volume}}{{$parameter.path}}',
                    qs: {
                        page_size: '={{$parameter.additionalFields?.pageSize}}',
                        page_token: '={{$parameter.additionalFields?.pageToken}}',
                    },
                },
            },
        },
        {
            name: 'Create Directory',
            value: 'createDirectory',
            description: 'Create a directory in volume',
            action: 'Create a directory',
            routing: {
                request: {
                    method: 'PUT',
                    url: '=/api/2.0/fs/directories/Volumes/{{$parameter.catalog}}/{{$parameter.schema}}/{{$parameter.volume}}{{$parameter.path}}',
                },
            },
        },
        {
            name: 'Delete Directory',
            value: 'deleteDirectory',
            description: 'Delete a directory in volume',
            action: 'Delete a directory',
            routing: {
                request: {
                    method: 'DELETE',
                    url: '=/api/2.0/fs/directories/Volumes/{{$parameter.catalog}}/{{$parameter.schema}}/{{$parameter.volume}}{{$parameter.path}}',
                },
            },
        },
    ],
    default: 'listDirectory',
};