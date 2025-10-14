import type { INodeProperties } from 'n8n-workflow';

export const unityCatalogParameters: INodeProperties[] = [
	{
		displayName: 'Table',
		name: 'fullName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The table to access',
		displayOptions: {
			show: {
				operation: ['getTable'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getTables',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'string',
				type: 'string',
				placeholder: 'catalog.schema.table',
				hint: 'Enter full table name in format: catalog.schema.table',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+$',
							errorMessage: 'Must be in format: catalog.schema.table (e.g., main.default.my_table)',
						},
					},
				],
			},
		],
	},
	{
		displayName: 'Function',
		name: 'fullName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The function to access',
		displayOptions: {
			show: {
				operation: ['getFunction', 'deleteFunction'],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getFunctions',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'string',
				type: 'string',
				placeholder: 'catalog.schema.function',
				hint: 'Enter full function name in format: catalog.schema.function',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+$',
							errorMessage: 'Must be in format: catalog.schema.function (e.g., main.default.my_function)',
						},
					},
				],
			},
		],
	},

	// Catalog Name parameter (resourceLocator) - for catalog operations and create/delete/get operations
	{
		displayName: 'Catalog',
		name: 'catalogName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The catalog to use',
		displayOptions: {
			show: {
				operation: [
					'getCatalog',
					'updateCatalog',
					'deleteCatalog',
					'createCatalog',
					'createVolume',
					'getVolume',
					'deleteVolume',
					'createFunction',
				],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getCatalogs',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'string',
				type: 'string',
				placeholder: 'main',
				hint: 'Enter catalog name or leave empty to list all',
			},
		],
	},

	// Catalog Name (optional) - for list operations
	{
		displayName: 'Catalog',
		name: 'catalogName',
		type: 'resourceLocator',
		default: { mode: 'string', value: '' },
		required: false,
		description: 'Filter by catalog (optional)',
		displayOptions: {
			show: {
				operation: [
					'listVolumes',
					'listTables',
					'listFunctions',
				],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getCatalogs',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'string',
				type: 'string',
				placeholder: 'main',
				hint: 'Enter catalog name or leave empty to list all',
			},
		],
	},

	// Schema Name parameter (resourceLocator) - for create/delete/get operations
	{
		displayName: 'Schema',
		name: 'schemaName',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description: 'The schema to use',
		displayOptions: {
			show: {
				operation: [
					'createVolume',
					'getVolume',
					'deleteVolume',
					'createFunction',
				],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getSchemas',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'string',
				type: 'string',
				placeholder: 'default',
				hint: 'Enter schema name or leave empty to list all',
			},
		],
	},

	// Schema Name (optional) - for list operations
	{
		displayName: 'Schema',
		name: 'schemaName',
		type: 'resourceLocator',
		default: { mode: 'string', value: '' },
		required: false,
		description: 'Filter by schema (optional, requires catalog)',
		displayOptions: {
			show: {
				operation: [
					'listVolumes',
					'listTables',
					'listFunctions',
				],
			},
		},
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: {
					searchListMethod: 'getSchemas',
					searchable: true,
				},
			},
			{
				displayName: 'By Name',
				name: 'string',
				type: 'string',
				placeholder: 'schema',
				hint: 'Enter full schema name or leave empty to list all',
			},
		],
	},

	// Volume Name - for create/get/delete volume
	{
		displayName: 'Volume Name',
		name: 'volumeName',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'my_volume',
		description: 'Name of the volume',
		displayOptions: {
			show: {
				operation: ['createVolume', 'getVolume', 'deleteVolume'],
			},
		},
	},

	// Volume Type - for create volume
	{
		displayName: 'Volume Type',
		name: 'volumeType',
		type: 'options',
		required: true,
		default: 'MANAGED',
		description: 'The type of volume to create',
		options: [
			{
				name: 'Managed',
				value: 'MANAGED',
				description: 'Databricks manages the volume storage',
			},
			{
				name: 'External',
				value: 'EXTERNAL',
				description: 'Volume points to external storage',
			},
		],
		displayOptions: {
			show: {
				operation: ['createVolume'],
			},
		},
	},

	// Function Name - for create function
	{
		displayName: 'Function Name',
		name: 'functionName',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'my_function',
		description: 'Name of the function to create',
		displayOptions: {
			show: {
				operation: ['createFunction'],
			},
		},
	},

	// Input Parameters - for create function
	{
		displayName: 'Input Parameters',
		name: 'inputParams',
		type: 'json',
		required: true,
		default: '[]',
		placeholder: '[{"name": "param1", "type_name": "STRING"}]',
		description: 'Array of input parameters for the function',
		displayOptions: {
			show: {
				operation: ['createFunction'],
			},
		},
	},

	// Return Type - for create function
	{
		displayName: 'Return Type',
		name: 'returnType',
		type: 'string',
		required: true,
		default: 'STRING',
		placeholder: 'STRING',
		description: 'The return type of the function (e.g., STRING, INT, DOUBLE)',
		displayOptions: {
			show: {
				operation: ['createFunction'],
			},
		},
	},

	// Routine Body - for create function
	{
		displayName: 'Routine Body',
		name: 'routineBody',
		type: 'string',
		required: true,
		default: 'SQL',
		description: 'The language of the function body',
		displayOptions: {
			show: {
				operation: ['createFunction'],
			},
		},
	},

	// Comment - for create/update catalog
	{
		displayName: 'Comment',
		name: 'comment',
		type: 'string',
		required: false,
		default: '',
		placeholder: 'Catalog description',
		description: 'Optional comment or description',
		displayOptions: {
			show: {
				operation: [
					'createCatalog',
					'updateCatalog',
				],
			},
		},
	},

	// Additional Fields for volume operations
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				operation: ['createVolume'],
			},
		},
		options: [
			{
				displayName: 'Comment',
				name: 'comment',
				type: 'string',
				default: '',
				description: 'Optional comment or description for the volume',
			},
			{
				displayName: 'Storage Location',
				name: 'storage_location',
				type: 'string',
				default: '',
				description: 'External storage location (required for EXTERNAL volumes)',
			},
		],
	},
];
