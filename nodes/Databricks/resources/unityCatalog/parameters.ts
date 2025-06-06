import type { INodeProperties } from 'n8n-workflow';

export const unityCatalogParameters: INodeProperties[] = [
    {
        displayName: 'Catalog',
        name: 'catalog',
        type: 'options',
        required: true,
        default: '',
        description: 'Select a Unity Catalog to work with. The list is automatically populated from your Databricks workspace',
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
                                    name: '={{$responseItem.name}} {{$responseItem.comment ? `(${$responseItem.comment})` : ""}}',
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
                resource: [
                    'unityCatalog',
                ],
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
        displayOptions: {
            show: {
                resource: [
                    'unityCatalog',
                ],
            },
        },
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
                                    name: '={{$responseItem.name}} {{$responseItem.comment ? `(${$responseItem.comment})` : ""}}',
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
    },
    {
        displayName: 'Volume',
        name: 'volumeName',
        type: 'options',
        required: true,
        default: '',
        description: 'Select a volume from the chosen catalog and schema',
        displayOptions: {
            show: {
                operation: [
                    'createVolume',
                    'deleteVolume',
                    'updateVolume',
                ],
            },
        },
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
                                    name: '={{$responseItem.name}} {{$responseItem.comment ? `(${$responseItem.comment})` : ""}} [{{$responseItem.volume_type}}]',
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
    },
    {
        displayName: 'Volume Type',
        name: 'volumeType',
        type: 'options',
        required: true,
        default: '',
        description: 'The type of volume to create',
        options: [
            {
                name: 'EXTERNAL',
                value: 'EXTERNAL',
            },
            {
                name: 'MANAGED',
                value: 'MANAGED',
            },
        ],
        displayOptions: {
            show: {
                operation: [
                    'createVolume',
                ],
            },
        },
    },
];