import type { INodeProperties } from 'n8n-workflow';

export const filesParameters: INodeProperties[] = [
    {
        displayName: 'Catalog',
        name: 'catalog',
        type: 'options',
        required: true,
        default: '',
        description: 'Select a catalog to access',
        typeOptions: {
            loadOptions: {
                routing: {
                    request: {
                        method: 'GET',
                        url: '=/api/2.1/unity-catalog/catalogs',
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
        description: 'Path to the file within the volume (e.g. "folder/file.txt" or "file.txt"). Do not include leading slash.',
        placeholder: 'folder/file.txt',
    },
    {
        displayName: 'Input Data Field Name',
        name: 'dataFieldName',
        type: 'string',
        default: 'data',
        required: true,
        description: 'Name of the field from input that contains the binary data to be uploaded',
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
        description: 'Path to directory within the volume (e.g. "folder1" or "folder1/subfolder"). Do not include leading slash.',
        placeholder: 'folder1',
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