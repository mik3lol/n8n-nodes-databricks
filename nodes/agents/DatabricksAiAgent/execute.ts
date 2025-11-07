import type { StreamEvent } from '@langchain/core/dist/tracers/event_stream';
import type { IterableReadableStream } from '@langchain/core/dist/utils/stream';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AIMessageChunk, MessageContentText } from '@langchain/core/messages';
import type { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import {
    AgentExecutor,
    type AgentRunnableSequence,
    createToolCallingAgent,
} from 'langchain/agents';
import type { BaseChatMemory } from 'langchain/memory';
import type { DynamicStructuredTool, Tool } from 'langchain/tools';
import omit from 'lodash/omit';
import { jsonParse, NodeOperationError, sleep } from 'n8n-workflow';
import type { IExecuteFunctions, INodeExecutionData, ISupplyDataFunctions } from 'n8n-workflow';
import assert from 'node:assert';
import { CallbackHandler } from './CallbackHandler';
import * as mlflow from "mlflow-tracing";

import { getPromptInputByType } from './src/utils/helpers';

import {
    getOptionalOutputParser,
    type N8nOutputParser,
} from './src/utils/N8nOutputParser';

import {
    fixEmptyContentMessage,
    getAgentStepsParser,
    getChatModel,
    getOptionalMemory,
    getTools,
    prepareMessages,
    preparePrompt,
} from './src/utils/common';

import { SYSTEM_MESSAGE } from './src/utils/prompt';
import { MLFLOW_CONSTANTS, ERROR_MESSAGES } from './src/constants';
import { maskTokensInText } from './src/utils/retry';
import {
    validateDatabricksHost,
} from './src/utils/security';

// MLflow will be initialized dynamically per execution based on credentials

/**
 * Creates an agent executor with the given configuration.
 *
 * This function sets up the LangChain agent with tools, prompt, memory, and optional fallback model.
 * If MLflow logging is enabled, it registers the callback handler for tracing.
 *
 * @param model - The primary chat model to use for the agent
 * @param tools - Array of tools available to the agent
 * @param prompt - The chat prompt template
 * @param options - Configuration options including max iterations and intermediate steps
 * @param outputParser - Optional output parser for structured responses
 * @param memory - Optional chat memory for conversation history
 * @param fallbackModel - Optional fallback model if primary model fails
 * @param mlflowHandler - Optional MLflow callback handler for tracing
 * @returns Configured AgentExecutor instance
 *
 * @example
 * ```typescript
 * const executor = createAgentExecutor(
 *   chatModel,
 *   [searchTool, calculatorTool],
 *   promptTemplate,
 *   { maxIterations: 10, returnIntermediateSteps: true },
 *   outputParser,
 *   memory,
 *   fallbackChatModel,
 *   mlflowHandler
 * );
 * ```
 */
function createAgentExecutor(
    model: BaseChatModel,
    tools: Array<DynamicStructuredTool | Tool>,
    prompt: ChatPromptTemplate,
    options: { maxIterations?: number; returnIntermediateSteps?: boolean },
    outputParser?: N8nOutputParser,
    memory?: BaseChatMemory,
    fallbackModel?: BaseChatModel | null,
    mlflowHandler?: CallbackHandler
) {
    const callbacks = mlflowHandler ? [mlflowHandler] : [];

    const agent = createToolCallingAgent({
        llm: model,
        tools,
        prompt,
        streamRunnable: false,
    });

    let fallbackAgent: AgentRunnableSequence | undefined;
    if (fallbackModel) {
        fallbackAgent = createToolCallingAgent({
            llm: fallbackModel,
            tools,
            prompt,
            streamRunnable: false,
        });
    }
    const runnableAgent = RunnableSequence.from([
        fallbackAgent ? agent.withFallbacks([fallbackAgent]) : agent,
        getAgentStepsParser(outputParser, memory),
        fixEmptyContentMessage,
    ]) as AgentRunnableSequence;

    runnableAgent.singleAction = false;
    runnableAgent.streamRunnable = false;

    return AgentExecutor.fromAgentAndTools({
        agent: runnableAgent,
        memory,
        tools,
        returnIntermediateSteps: options.returnIntermediateSteps === true,
        maxIterations: options.maxIterations ?? 10,
        callbacks,
    });
}


/**
 * Processes the event stream from the agent executor in streaming mode.
 *
 * This function handles streaming chat model tokens as they arrive, sending them to the
 * n8n UI in real-time. It also captures intermediate steps (tool calls and results) when requested.
 *
 * @param ctx - The n8n execution context
 * @param eventStream - The iterable stream of events from the agent
 * @param itemIndex - Index of the current item being processed
 * @param returnIntermediateSteps - Whether to capture and return intermediate agent steps
 * @returns Promise resolving to the complete output and optional intermediate steps
 *
 * @example
 * ```typescript
 * const result = await processEventStream(
 *   this,
 *   agentEventStream,
 *   0,
 *   true  // return intermediate steps
 * );
 * console.log(result.output); // "The weather is sunny..."
 * console.log(result.intermediateSteps); // [{ action: {...}, observation: "..." }]
 * ```
 */
async function processEventStream(
    ctx: IExecuteFunctions,
    eventStream: IterableReadableStream<StreamEvent>,
    itemIndex: number,
    returnIntermediateSteps: boolean = false,
): Promise<{ output: string; intermediateSteps?: any[] }> {
    const agentResult: { output: string; intermediateSteps?: any[] } = {
        output: '',
    };

    if (returnIntermediateSteps) {
        agentResult.intermediateSteps = [];
    }

    // @ts-ignore - sendChunk may not be available in all n8n versions
    if (ctx.sendChunk) ctx.sendChunk('begin', itemIndex);
    for await (const event of eventStream) {
        // Stream chat model tokens as they come in
        switch (event.event) {
            case 'on_chat_model_stream':
                const chunk = event.data?.chunk as AIMessageChunk;
                if (chunk?.content) {
                    const chunkContent = chunk.content;
                    let chunkText = '';
                    if (Array.isArray(chunkContent)) {
                        for (const message of chunkContent) {
                            chunkText += (message as MessageContentText)?.text;
                        }
                    } else if (typeof chunkContent === 'string') {
                        chunkText = chunkContent;
                    }
                    // @ts-ignore - sendChunk may not be available in all n8n versions
                    if (ctx.sendChunk) ctx.sendChunk('item', itemIndex, chunkText);

                    agentResult.output += chunkText;
                }
                break;
            case 'on_chat_model_end':
                // Capture full LLM response with tool calls for intermediate steps
                if (returnIntermediateSteps && event.data) {
                    const chatModelData = event.data as { output?: { tool_calls?: Array<{ id: string; name: string; args: unknown; type: string }>; content?: string } };
                    const output = chatModelData.output;

                    // Check if this LLM response contains tool calls
                    if (output?.tool_calls && output.tool_calls.length > 0) {
                        for (const toolCall of output.tool_calls) {
                            agentResult.intermediateSteps!.push({
                                action: {
                                    tool: toolCall.name,
                                    toolInput: toolCall.args,
                                    log:
                                        output.content ||
                                        `Calling ${toolCall.name} with input: ${JSON.stringify(toolCall.args)}`,
                                    messageLog: [output], // Include the full LLM response
                                    toolCallId: toolCall.id,
                                    type: toolCall.type,
                                },
                            });
                        }
                    }
                }
                break;
            case 'on_tool_end':
                // Capture tool execution results and match with action
                if (returnIntermediateSteps && event.data && agentResult.intermediateSteps!.length > 0) {
                    const toolData = event.data as { output?: unknown };
                    // Find the matching intermediate step for this tool call
                    const matchingStep = agentResult.intermediateSteps!.find(
                        (step) => !step.observation && step.action.tool === event.name,
                    );
                    if (matchingStep) {
                        matchingStep.observation = toolData.output;
                    }
                }
                break;
            default:
                break;
        }
    }
    // @ts-ignore - sendChunk may not be available in all n8n versions
    if (ctx.sendChunk) ctx.sendChunk('end', itemIndex);

    return agentResult;
}

/* -----------------------------------------------------------
   Main Executor Function
----------------------------------------------------------- */
/**
 * The main executor method for the Tools Agent.
 *
 * This function retrieves necessary components (model, memory, tools), prepares the prompt,
 * creates the agent, and processes each input item. The error handling for each item is also
 * managed here based on the node's continueOnFail setting.
 *
 * @param this Execute context. SupplyDataContext is passed when agent is as a tool
 *
 * @returns The array of execution data for all processed items
 */
export async function toolsAgentExecute(
    this: IExecuteFunctions | ISupplyDataFunctions,
): Promise<INodeExecutionData[][]> {
    // Check if MLflow logging is enabled
    const enableMLflow = this.getNodeParameter('enableMLflow', 0, false) as boolean;

    if (enableMLflow) {
        // Get Databricks credentials
        const credentials = await this.getCredentials('databricks');

        if (!credentials) {
            throw new NodeOperationError(
                this.getNode(),
                ERROR_MESSAGES.MISSING_CREDENTIALS,
            );
        }

        // Validate credentials have required fields
        if (!credentials.host || typeof credentials.host !== 'string' || credentials.host.trim() === '') {
            throw new NodeOperationError(
                this.getNode(),
                ERROR_MESSAGES.EMPTY_HOST,
            );
        }

        if (!credentials.token || typeof credentials.token !== 'string' || credentials.token.trim() === '') {
            throw new NodeOperationError(
                this.getNode(),
                ERROR_MESSAGES.EMPTY_TOKEN,
            );
        }

        // Warn if token looks suspiciously short
        const token = credentials.token as string;
        if (token.length < MLFLOW_CONSTANTS.MIN_DATABRICKS_TOKEN_LENGTH) {
            this.logger.warn(ERROR_MESSAGES.SHORT_TOKEN_WARNING(token.length));
        }

        // Validate and clean Databricks host URL with security checks
        const rawHost = credentials.host as string;
        let databricksHost: string;
        try {
            const cleanedHost = rawHost.trim().replace(/\/$/, '');

            // Handle case where user didn't include protocol
            const hostWithProtocol = cleanedHost.startsWith('http')
                ? cleanedHost
                : `https://${cleanedHost}`;

            // Security validation: Check for SSRF and invalid hosts
            const hostValidation = validateDatabricksHost(hostWithProtocol);
            if (!hostValidation.isValid) {
                throw new Error(hostValidation.error);
            }

            const url = new URL(hostWithProtocol);

            // Warn if using HTTP instead of HTTPS
            if (url.protocol === 'http:') {
                this.logger.warn(ERROR_MESSAGES.HTTP_INSECURE_WARNING(url.href));
            } else if (url.protocol !== 'https:') {
                throw new Error(`Host must use HTTP or HTTPS protocol, got: ${url.protocol}`);
            }

            if (!url.hostname) {
                throw new Error('Invalid host URL: missing hostname');
            }

            databricksHost = hostValidation.sanitized!;
        } catch (validationError: unknown) {
            const errorMsg = validationError instanceof Error ? validationError.message : 'Invalid URL format';
            throw new NodeOperationError(
                this.getNode(),
                ERROR_MESSAGES.INVALID_HOST_URL(rawHost, errorMsg)
            );
        }

        const workflowId = this.getWorkflow().id;
        const experimentName = `/Shared/n8n-workflows-${workflowId}`;

        let experimentId: string | undefined;

        try {
            // Initialize MLflow client for experiment management
            const client = new mlflow.MlflowClient({
                trackingUri: 'databricks',
                host: databricksHost,
                databricksToken: credentials.token as string,
            });

            try {
                // Try to create experiment using SDK
                experimentId = await client.createExperiment(experimentName);
            } catch (createError: unknown) {
                // Experiment already exists, get ID by name
                // Note: MlflowClient doesn't have getExperimentByName method
                const getResponse = await this.helpers.request({
                    method: 'GET',
                    url: `${databricksHost}/api/2.0/mlflow/experiments/get-by-name`,
                    headers: {
                        'Authorization': `Bearer ${credentials.token}`,
                        'Content-Type': 'application/json',
                    },
                    qs: {
                        experiment_name: experimentName,
                    },
                    json: true,
                });

                if (getResponse && getResponse.experiment && getResponse.experiment.experiment_id) {
                    experimentId = getResponse.experiment.experiment_id;
                } else {
                    throw createError;
                }
            }

            if (!experimentId) {
                throw new Error('Failed to get or create experiment ID');
            }

            mlflow.init({
                trackingUri: 'databricks',
                experimentId: experimentId,
                host: databricksHost,
                databricksToken: credentials.token as string,
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new NodeOperationError(
                this.getNode(),
                `Failed to setup MLflow experiment: ${maskTokensInText(errorMessage)}`
            );
        }
    }

    const returnData: INodeExecutionData[] = [];
    const items = this.getInputData();

    if (!items || items.length === 0) {
        return [returnData];
    }

    // Validate and sanitize batch parameters
    const rawBatchSize = this.getNodeParameter('options.batching.batchSize', 0, 1) as number;

    // Comprehensive batch size validation
    let batchSize: number;
    if (!Number.isFinite(rawBatchSize) || rawBatchSize < 1) {
        this.logger.warn(`Invalid batch size ${rawBatchSize}, using default: 1`);
        batchSize = 1;
    } else if (rawBatchSize > items.length) {
        this.logger.warn(`Batch size ${rawBatchSize} exceeds items count ${items.length}, using ${items.length}`);
        batchSize = items.length;
    } else {
        batchSize = Math.floor(rawBatchSize);
        if (batchSize !== rawBatchSize) {
            this.logger.warn(`Non-integer batch size ${rawBatchSize}, rounded to ${batchSize}`);
        }
    }

    // Validate delay with upper bound
    const rawDelayBetweenBatches = this.getNodeParameter(
        'options.batching.delayBetweenBatches',
        0,
        0,
    ) as number;

    let delayBetweenBatches: number;
    if (!Number.isFinite(rawDelayBetweenBatches) || rawDelayBetweenBatches < 0) {
        this.logger.warn(`Invalid delay ${rawDelayBetweenBatches}, using 0`);
        delayBetweenBatches = 0;
    } else if (rawDelayBetweenBatches > MLFLOW_CONSTANTS.MAX_DELAY_BETWEEN_BATCHES_MS) {
        this.logger.warn(`Delay ${rawDelayBetweenBatches}ms exceeds maximum ${MLFLOW_CONSTANTS.MAX_DELAY_BETWEEN_BATCHES_MS}ms, capping to maximum`);
        delayBetweenBatches = MLFLOW_CONSTANTS.MAX_DELAY_BETWEEN_BATCHES_MS;
    } else {
        delayBetweenBatches = Math.floor(rawDelayBetweenBatches);
        if (delayBetweenBatches !== rawDelayBetweenBatches) {
            this.logger.warn(`Non-integer delay ${rawDelayBetweenBatches}, rounded to ${delayBetweenBatches}`);
        }
    }
    const needsFallback = this.getNodeParameter('needsFallback', 0, false) as boolean;
    const memory = await getOptionalMemory(this);
    const model = await getChatModel(this, 0);
    assert(model, ERROR_MESSAGES.MODEL_NOT_CONNECTED);
    const fallbackModel = needsFallback ? await getChatModel(this, 1) : null;

    if (needsFallback && !fallbackModel) {
        throw new NodeOperationError(
            this.getNode(),
            ERROR_MESSAGES.FALLBACK_MODEL_NOT_CONNECTED,
        );
    }

    // Check if streaming is enabled
    const enableStreaming = this.getNodeParameter('options.enableStreaming', 0, true) as boolean;

    // Track all handlers for cleanup
    const mlflowHandlers: CallbackHandler[] = [];

    try {
        for (let i = 0; i < items.length; i += batchSize) {
        // Check for cancellation before processing each batch
        const cancelSignal = this.getExecutionCancelSignal();
        if (cancelSignal?.aborted) {
            const currentBatch = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(items.length / batchSize);
            this.logger.info(`Execution cancelled at batch ${currentBatch}`);
            throw new NodeOperationError(
                this.getNode(),
                ERROR_MESSAGES.EXECUTION_CANCELLED(currentBatch, totalBatches)
            );
        }

        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(async (_item, batchItemIndex) => {
            const itemIndex = i + batchItemIndex;

            const input = getPromptInputByType({
                ctx: this,
                i: itemIndex,
                inputKey: 'text',
                promptTypeKey: 'promptType',
            });
            if (input === undefined) {
                throw new NodeOperationError(this.getNode(), 'The "text" parameter is empty.');
            }
            const outputParser = await getOptionalOutputParser(this, itemIndex);
            const tools = await getTools(this, outputParser);
            const options = this.getNodeParameter('options', itemIndex, {}) as {
                systemMessage?: string;
                maxIterations?: number;
                returnIntermediateSteps?: boolean;
                passthroughBinaryImages?: boolean;
            };
            // Define mlflow callback handler for tracing (only if MLflow is enabled)
            const mlflowHandler = enableMLflow ? new CallbackHandler({}) : undefined;

            // Track handler for cleanup
            if (mlflowHandler) {
                mlflowHandlers.push(mlflowHandler);
            }

            // Prepare the prompt messages and prompt template.
            const messages = await prepareMessages(this, itemIndex, {
                systemMessage: options.systemMessage,
                passthroughBinaryImages: options.passthroughBinaryImages ?? true,
                outputParser,
            });
            const prompt: ChatPromptTemplate = preparePrompt(messages);

            // Create executors for primary and fallback models
            const executor = createAgentExecutor(
                model,
                tools,
                prompt,
                options,
                outputParser,
                memory,
                fallbackModel,
                mlflowHandler
            );
            // Invoke with fallback logic
            const invokeParams: any = {
                input,
                system_message: options.systemMessage ?? SYSTEM_MESSAGE,
            };

            // Only include formatting_instructions if outputParser is present
            if (outputParser) {
                invokeParams.formatting_instructions =
                    'IMPORTANT: For your response to user, you MUST use the `format_final_json_response` tool with your complete answer formatted according to the required schema. Do not attempt to format the JSON manually - always use this tool. Your response will be rejected if it is not properly formatted through this tool. Only use this tool once you are ready to provide your final answer.';
            }
            const executeOptions = {
                signal: this.getExecutionCancelSignal(),
                callbacks: mlflowHandler ? [mlflowHandler] : []
            };

            // Check if streaming is actually available
            // @ts-ignore - isStreaming may not be available in all n8n versions
            const isStreamingAvailable = 'isStreaming' in this ? this.isStreaming?.() : undefined;

            if (
                'isStreaming' in this &&
                enableStreaming &&
                isStreamingAvailable &&
                this.getNode().typeVersion >= 2.1
            ) {
                const chatHistory = await memory?.chatHistory.getMessages();
                const eventStream = executor.streamEvents(
                    {
                        ...invokeParams,
                        chat_history: chatHistory ?? undefined,
                    },
                    {
                        version: 'v2',
                        ...executeOptions,
                    },
                );

                return await processEventStream(
                        // @ts-ignore - Type compatibility with streaming context
                        this as IExecuteFunctions,
                        eventStream,
                        itemIndex,
                        options.returnIntermediateSteps,
                );

            } else {
                return await executor.invoke(invokeParams, executeOptions);
            }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        // This is only used to check if the output parser is connected
        // so we can parse the output if needed. Actual output parsing is done in the loop above
        const outputParser = await getOptionalOutputParser(this, 0);
        batchResults.forEach((result, index) => {
            const itemIndex = i + index;
            if (result.status === 'rejected') {
                const error = result.reason as Error;
                // Security: Mask tokens in error messages
                const maskedMessage = maskTokensInText(error.message);
                const maskedStack = error.stack ? maskTokensInText(error.stack) : undefined;

                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: maskedMessage, stack: maskedStack },
                        pairedItem: { item: itemIndex },
                    });
                    return;
                } else {
                    // Add more context to the error
                    const enhancedError = new Error(`Agent execution failed: ${maskedMessage}\n\nOriginal stack:\n${maskedStack || 'N/A'}`);
                    throw new NodeOperationError(this.getNode(), enhancedError);
                }
            }
            const response = result.value;

            // Handle OpenAI reasoning model output format
            // OpenAI OSS reasoning models return structured JSON with reasoning and text fields
            // Extract only the text content to match default agent behavior
            if (Array.isArray(response.output)) {
                const textItems = response.output.filter((item: any) => item?.type === 'text');
                if (textItems.length > 0) {
                    response.output = textItems.map((item: any) => item.text).join('\n');
                }
            }

            // If memory and outputParser are connected, parse the output.
            if (memory && outputParser) {
                const parsedOutput = jsonParse<{ output: Record<string, unknown> }>(
                    response.output as string,
                );
                response.output = parsedOutput?.output ?? parsedOutput;
            }

            // Omit internal keys before returning the result.
            const itemResult = {
                json: omit(
                    response,
                    'system_message',
                    'formatting_instructions',
                    'input',
                    'chat_history',
                    'agent_scratchpad',
                ),
                pairedItem: { item: itemIndex },
            };

            returnData.push(itemResult);
        });

        if (i + batchSize < items.length && delayBetweenBatches > 0) {
            await sleep(delayBetweenBatches);
        }
        }

        return [returnData];
    } finally {
        // Wait for all pending operations to complete before cleanup
        await Promise.allSettled(
            mlflowHandlers.map(async (handler) => {
                try {
                    // Give some time for any pending span operations to complete
                    await new Promise(resolve => setTimeout(resolve, MLFLOW_CONSTANTS.SPAN_CLEANUP_DELAY_MS));
                    handler.cleanup();
                } catch (cleanupError: unknown) {
                    const errorMsg = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
                    // Security: Mask any tokens in cleanup errors
                    this.logger.debug(`Error cleaning up MLflow handler: ${maskTokensInText(errorMsg)}`);
                }
            })
        );
    }
}