import type { INodeProperties } from 'n8n-workflow';

export const filesParameters: INodeProperties[] = [
    {
        displayName: 'Catalog',
        name: 'catalog',
        type: 'options',
        required: true,
        default: '',
        description: 'Select a Unity Catalog to access files from',
        typeOptions: {
            loadOptions: {
                routing: {
                    request: {
                        method: 'GET',
                        url: '/api/2.1/unity-catalog/catalogs',
                    },
                    output: {
                        postReceive: [
                            {
                                type: 'rootProperty',
                                properties: {
                                    property: 'catalogs',
                                },
                            },
                            {
                                type: 'setKeyValue',
                                properties: {
                                    name: '={{$responseItem.name}}',
                                    value: '={{$responseItem.name}}',
                                },
                            },
                            {
                                type: 'sort',
                                properties: {
                                    key: 'name',
                                },
                            },
                        ],
                    },
                },
            },
        },
        displayOptions: {
            show: {
                resource: ['files'],
            },
        },
    },
    {
        displayName: 'Schema',
        name: 'schema',
        type: 'options',
        required: true,
        default: '',
        description: 'Select a schema from the chosen catalog',
        typeOptions: {
            loadOptions: {
                routing: {
                    request: {
                        method: 'GET',
                        url: '=/api/2.1/unity-catalog/schemas?catalog_name={{$parameter["catalog"]}}',
                    },
                    output: {
                        postReceive: [
                            {
                                type: 'rootProperty',
                                properties: {
                                    property: 'schemas',
                                },
                            },
                            {
                                type: 'setKeyValue',
                                properties: {
                                    name: '={{$responseItem.name}}',
                                    value: '={{$responseItem.name}}',
                                },
                            },
                            {
                                type: 'sort',
                                properties: {
                                    key: 'name',
                                },
                            },
                        ],
                    },
                },
            },
        },
        displayOptions: {
            show: {
                resource: ['files'],
            },
        },
    },
    {
        displayName: 'Volume',
        name: 'volume',
        type: 'options',
        required: true,
        default: '',
        description: 'Select a volume from the chosen catalog and schema',
        typeOptions: {
            loadOptions: {
                routing: {
                    request: {
                        method: 'GET',
                        url: '=/api/2.1/unity-catalog/volumes?catalog_name={{$parameter["catalog"]}}&schema_name={{$parameter["schema"]}}',
                    },
                    output: {
                        postReceive: [
                            {
                                type: 'rootProperty',
                                properties: {
                                    property: 'volumes',
                                },
                            },
                            {
                                type: 'setKeyValue',
                                properties: {
                                    name: '={{$responseItem.name}}',
                                    value: '={{$responseItem.name}}',
                                },
                            },
                            {
                                type: 'sort',
                                properties: {
                                    key: 'name',
                                },
                            },
                        ],
                    },
                },
            },
        },
        displayOptions: {
            show: {
                resource: ['files'],
            },
        },
    },
    {
        displayName: 'File Name',
        name: 'path',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
            show: {
                operation: [
                    'uploadFile',
                    'downloadFile',
                    'deleteFile',
                    'getFileInfo',
                ],
            },
        },
        description: 'Name of the file (e.g., "myfile.txt" or "folder/myfile.txt")',
        placeholder: 'myfile.txt',
    },
    {
        displayName: 'Binary Property',
        name: 'binaryPropertyName',
        type: 'string',
        default: 'data',
        required: true,
        displayOptions: {
            show: {
                operation: ['uploadFile'],
            },
        },
        description: 'Name of the binary property that contains the file data to upload',
    },
    {
        displayName: 'Content Type',
        name: 'contentType',
        type: 'options',
        options: [
            {
                name: 'Application/Octet-Stream',
                value: 'application/octet-stream',
                description: 'Binary data',
            },
            {
                name: 'Text/Plain',
                value: 'text/plain',
                description: 'Plain text',
            },
            {
                name: 'Application/JSON',
                value: 'application/json',
                description: 'JSON data',
            },
            {
                name: 'Application/XML',
                value: 'application/xml',
                description: 'XML data',
            },
            {
                name: 'Image/JPEG',
                value: 'image/jpeg',
                description: 'Image data (e.g. PNG, JPEG)',
            },
        ],
        default: 'application/octet-stream',
        description: 'The content type of the file being uploaded',
        displayOptions: {
            show: {
                resource: ['files'],
                operation: ['uploadFile'],
            },
        },
    },
    {
        displayName: 'Directory Name',
        name: 'path',
        type: 'string',
        required: true,
        default: '',
        displayOptions: {
            show: {
                operation: [
                    'createDirectory',
                    'deleteDirectory',
                ],
            },
        },
        description: 'Name of the directory to create or delete (e.g., "folder1" or "folder1/subfolder")',
        placeholder: 'myfolder',
    },
    {
        displayName: 'Additional Fields',
        name: 'additionalFields',
        type: 'collection',
        placeholder: 'Add Field',
        default: {},
        displayOptions: {
            show: {
                operation: [
                    'listDirectory',
                    'uploadFile',
                ],
            },
        },
        options: [
            {
                displayName: 'Page Size',
                name: 'pageSize',
                type: 'number',
                default: 1000,
                description: 'Number of files to return per page',
                displayOptions: {
                    show: {
                        '/operation': ['listDirectory'],
                    },
                },
            },
            {
                displayName: 'Page Token',
                name: 'pageToken',
                type: 'string',
                default: '',
                description: 'Token for the next page of results',
                displayOptions: {
                    show: {
                        '/operation': ['listDirectory'],
                    },
                },
            },
            {
                displayName: 'Overwrite',
                name: 'overwrite',
                type: 'boolean',
                default: false,
                description: 'Whether to overwrite an existing file',
                displayOptions: {
                    show: {
                        '/operation': ['uploadFile'],
                    },
                },
            },
        ],
    },
];