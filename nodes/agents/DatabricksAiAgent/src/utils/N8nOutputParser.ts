import type { IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';

import { N8nStructuredOutputParser } from './output_parsers/N8nStructuredOutputParser';

export type N8nOutputParser = N8nStructuredOutputParser;

export { N8nStructuredOutputParser };

export async function getOptionalOutputParser(
    ctx: IExecuteFunctions | ISupplyDataFunctions,
    index: number = 0,
): Promise<N8nOutputParser | undefined> {
    if (ctx.getNodeParameter('hasOutputParser', 0, true) === true) {
        return (await ctx.getInputConnectionData(
            'ai_outputParser',
            index,
        )) as N8nStructuredOutputParser;
    }
    return undefined;
}
