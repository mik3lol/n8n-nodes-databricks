import type { DynamicStructuredToolInput } from '@langchain/core/tools';
import { DynamicStructuredTool, DynamicTool } from '@langchain/core/tools';
import type { ISupplyDataFunctions, IDataObject } from 'n8n-workflow';
import { NodeConnectionTypes, jsonParse, NodeOperationError } from 'n8n-workflow';
import type { ZodTypeAny } from 'zod';
import { ZodBoolean, ZodNullable, ZodNumber, ZodObject, ZodOptional } from 'zod';

const getSimplifiedType = (schema: ZodTypeAny) => {
	if (schema instanceof ZodObject) {
		return 'object';
	} else if (schema instanceof ZodNumber) {
		return 'number';
	} else if (schema instanceof ZodBoolean) {
		return 'boolean';
	} else if (schema instanceof ZodNullable || schema instanceof ZodOptional) {
		return getSimplifiedType(schema.unwrap());
	}

	return 'string';
};

const getParametersDescription = (parameters: Array<[string, ZodTypeAny]>) =>
	parameters
		.map(
			([name, schema]) =>
				`${name}: (description: ${schema.description ?? ''}, type: ${getSimplifiedType(schema)}, required: ${!schema.isOptional()})`,
		)
		.join(',\n ');

export const prepareFallbackToolDescription = (toolDescription: string, schema: ZodObject<any>) => {
	let description = `${toolDescription}`;

	const toolParameters = Object.entries<ZodTypeAny>(schema.shape);

	if (toolParameters.length) {
		description += `
Tool expects valid stringified JSON object with ${toolParameters.length} properties.
Property names with description, type and required status:
${getParametersDescription(toolParameters)}
ALL parameters marked as required must be provided`;
	}

	return description;
};

export class N8nTool extends DynamicStructuredTool {
	constructor(
		private context: ISupplyDataFunctions,
		fields: DynamicStructuredToolInput,
	) {
		super(fields);
	}

	asDynamicTool(): DynamicTool {
		const { name, func, schema, context, description } = this;
		
		// Ensure schema is a ZodObject
		if (!(schema instanceof ZodObject)) {
			throw new Error('Schema must be a ZodObject');
		}

		// Use the Zod schema directly for parsing
		const zodSchema = schema;

		const wrappedFunc = async function (query: string) {
			let parsedQuery: object;
			let dataToValidate;

			// First try to parse as JSON
			try {
				dataToValidate = jsonParse<IDataObject>(query, { acceptJSObject: true });
			} catch (error) {
				// If model supplied a simple string instead of an object AND only one parameter expected,
				// try to recover the object structure
				if (Object.keys(zodSchema.shape).length === 1) {
					const parameterName = Object.keys(zodSchema.shape)[0];
					dataToValidate = { [parameterName]: query };
				} else {
					throw new NodeOperationError(
						context.getNode(),
						`Input is not a valid JSON: ${error.message}`,
					);
				}
			}

			// Then validate using the Zod schema
			try {
				parsedQuery = zodSchema.parse(dataToValidate);
			} catch (error) {
				throw new NodeOperationError(
					context.getNode(),
					`Input validation failed: ${error.message}`,
				);
			}

			try {
				// Call tool function with parsed query
				const result = await func(parsedQuery);

				return result;
			} catch (e) {
				const { index } = context.addInputData(NodeConnectionTypes.AiTool, [[{ json: { query } }]]);
				void context.addOutputData(NodeConnectionTypes.AiTool, index, e);

				return e.toString();
			}
		};

		return new DynamicTool({
			name,
			description: prepareFallbackToolDescription(description, schema),
			func: wrappedFunc,
		});
	}
}
