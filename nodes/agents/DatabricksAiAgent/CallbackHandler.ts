import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { Document } from "@langchain/core/documents";
import type { Serialized } from "@langchain/core/load/serializable";
import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  type UsageMetadata,
  type BaseMessageFields,
} from "@langchain/core/messages";
import type { Generation, LLMResult } from "@langchain/core/outputs";
import type { ChainValues } from "@langchain/core/utils/types";
import { getLogger } from "log4js";
import * as mlflow from "mlflow-tracing";

export type LlmMessage = {
  role: string;
  content: BaseMessageFields["content"];
  additional_kwargs?: BaseMessageFields["additional_kwargs"];
};

export type AnonymousLlmMessage = {
  content: BaseMessageFields["content"];
  additional_kwargs?: BaseMessageFields["additional_kwargs"];
};

type ErrorLike = Error | { message: string; stack?: string; [key: string]: unknown };

interface ModelParameters {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  request_timeout?: number;
}

interface GenerationWithMetadata {
  message?: {
    response_metadata?: {
      model_name?: string;
    };
    usage_metadata?: UsageMetadata;
  };
}

type LLMTokenIndex = import("@langchain/core/dist/callbacks/base").NewTokenIndices;

type ConstructorParams = {
  userId?: string;
  sessionId?: string;
  tags?: string[];
  version?: string; // added to all traces and observations
  traceMetadata?: Record<string, unknown>; // added to all traces
};

export class CallbackHandler extends BaseCallbackHandler {
  name = "MLFlowCallbackHandler";
  private readonly runMap: Map<string, mlflow.LiveSpan> = new Map();
  private readonly maxMapSize = 1000; // Safety limit to prevent memory leaks

  private _lastTraceId: string | null = null;

  public get lastTraceId(): string | null {
    return this._lastTraceId;
  }

  constructor(params?: ConstructorParams) {
    super();
  }

  get logger() {
    return getLogger("Callback-handler");
  }

  /**
   * Helper method to log errors consistently
   */
  private logError(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.debug(`${context}: ${message}`);
  }

  /**
   * Ensures the runMap doesn't grow unbounded to prevent memory leaks
   */
  private ensureMapSize(): void {
    if (this.runMap.size <= this.maxMapSize) return;

    this.logger.warn(
      `runMap size (${this.runMap.size}) exceeded limit (${this.maxMapSize}). ` +
      'Cleaning up oldest entries. This may indicate spans not being properly closed.'
    );

    const entries = Array.from(this.runMap.entries());
    const toDelete = entries.slice(0, entries.length - this.maxMapSize);

    for (const [key, span] of toDelete) {
      try {
        span.end();
        this.logger.debug(`Force-closed orphaned span: ${key}`);
      } catch (e) {
        this.logError(`Failed to close orphaned span ${key}`, e);
      }
      this.runMap.delete(key);
    }
  }

  /**
   * Cleans up all remaining spans. Should be called when handler is no longer needed.
   */
  public cleanup(): void {
    if (this.runMap.size === 0) return;

    this.logger.debug(`Cleaning up ${this.runMap.size} remaining spans`);

    for (const [runId, span] of this.runMap.entries()) {
      try {
        span.end();
      } catch (e) {
        this.logError(`Failed to end span ${runId} during cleanup`, e);
      }
    }

    this.runMap.clear();
  }

  async handleLLMNewToken(
    token: string,
    _idx: LLMTokenIndex,
    runId: string,
    _parentRunId?: string,
    _tags?: string[],
    _fields?: Record<string, unknown>,
  ): Promise<void> {
    // if this is the first token, add it to completionStartTimes
    this.logger.info(`LLM returning token: ${token}`);
  }

  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    runType?: string,
    name?: string,
  ): Promise<void> {
    try {

      this.logger.debug(`Chain start with Id: ${runId}`);

      const runName = name ?? chain.id.at(-1)?.toString() ?? "Langchain Run";

      const filter_chains = ["runnablelambda", "runnablemap", "toolcallingagentoutputparser"]

      const filter_span = runName ? filter_chains.some(sub => runName.toLowerCase().includes(sub)) : false

      if(filter_span){
        // Skip tracing for internal LangChain utility chains
        return;
      }

      let chat_history = 'chat_history' in inputs ? inputs['chat_history']: undefined

      if(chat_history){
        chat_history = chat_history.map((m: BaseMessage) => this.extractChatMessageContent(m))
      }

      const user_message = {"content": inputs['input'], "role": "user"}

      const messages = chat_history ? chat_history.concat([user_message]): [user_message]

      this.startAndRegisterOtelSpan({
        type: mlflow.SpanType.AGENT,
        runName: runName,
        runId: runId,
        parentRunId: parentRunId,
        tags: tags,
        metadata: metadata,
        attributes: {
          messages: messages,
          system_message: inputs['system_message']
        },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleAgentAction(
    action: AgentAction,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Agent action ${action.tool} with ID: ${runId}`);

      // Note: Agent action tracing is handled by handleChainStart to avoid duplicate spans in MLflow

    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleAgentEnd?(
    action: AgentFinish,
    runId: string,
    parentRunId?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Agent finish with ID: ${runId}`);

      // Note: Agent end tracing is handled by handleChainEnd to avoid duplicate spans in MLflow
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleChainError(
    err: ErrorLike,
    runId: string,
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Chain error: ${errorMessage} with ID: ${runId}`);

      const azureRefusalError = this.parseAzureRefusalError(err);

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          level: "ERROR",
          statusMessage: errorMessage + azureRefusalError,
        },
      });
    } catch (e) {
      this.logError('handleChainError', e);
    }
  }

  async handleGenerationStart(
    llm: Serialized,
    messages: Record<string, unknown> | Record<string, unknown>[] | string[],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    this.logger.debug(
      `Generation start with ID: ${runId} and parentRunId ${parentRunId}`,
    );

    const runName = name ?? llm.id.at(-1)?.toString() ?? "Langchain Generation";

    const modelParameters: ModelParameters = {};
    const invocationParams = extraParams?.["invocation_params"] as Record<string, unknown> | undefined;

    if (invocationParams) {
      const paramKeys: Array<keyof ModelParameters> = [
        'temperature',
        'max_tokens',
        'top_p',
        'frequency_penalty',
        'presence_penalty',
        'request_timeout'
      ];

      for (const key of paramKeys) {
        const value = invocationParams[key];
        if (value !== undefined && value !== null && typeof value === 'number') {
          modelParameters[key] = value;
        }
      }
    }

    this.startAndRegisterOtelSpan({
      type: mlflow.SpanType.CHAT_MODEL,
      runName: runName,
      runId: runId,
      parentRunId: parentRunId,
      metadata: metadata,
      tags: tags,
      attributes: {
        messages: messages,
        modelParameters: modelParameters
      },
    });
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Chat model start with ID: ${runId}`);

      const prompts = messages.flatMap((message) =>
        message.map((m) => this.extractChatMessageContent(m)),
      );

      this.handleGenerationStart(
        llm,
        prompts,
        runId,
        parentRunId,
        extraParams,
        tags,
        metadata,
        name,
      );
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleChainEnd(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`Chain end with ID: ${runId}`);

      let finalOutput: ChainValues | string = outputs;
      if (
        typeof outputs === "object" &&
        "output" in outputs &&
        typeof outputs["output"] === "string"
      ) {
        finalOutput = outputs["output"];
      }

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          output: finalOutput,
        },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string | undefined,
    extraParams?: Record<string, unknown> | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`LLM start with ID: ${runId}`);

      this.handleGenerationStart(
        llm,
        prompts,
        runId,
        parentRunId,
        extraParams,
        tags,
        metadata,
        name,
      );
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Tool start with ID: ${runId}`);

      const tool_name = name ?? tool.id.at(-1)?.toString() ?? "Tool execution"

      this.startAndRegisterOtelSpan({
        type: mlflow.SpanType.TOOL,
        runId: runId,
        parentRunId: parentRunId,
        runName: tool_name,
        attributes: {
          tool_name: tool_name,
          args: input,
        },
        metadata: metadata,
        tags: tags,
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleRetrieverStart(
    retriever: Serialized,
    query: string,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    metadata?: Record<string, unknown> | undefined,
    name?: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Retriever start with ID: ${runId}`);

      this.startAndRegisterOtelSpan({
        type: mlflow.SpanType.RETRIEVER,
        runId:runId,
        parentRunId:parentRunId,
        runName: name ?? retriever.id.at(-1)?.toString() ?? "Retriever",
        attributes: {
          input: query,
        },
        tags:tags,
        metadata:metadata,
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleRetrieverEnd(
    documents: Document<Record<string, any>>[],
    runId: string,
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`Retriever end with ID: ${runId}`);

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          output: documents,
        },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleRetrieverError(
    err: ErrorLike,
    runId: string,
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Retriever error: ${errorMessage} with ID: ${runId}`);
      this.handleOtelSpanEnd({
        runId,
        attributes: {
          level: "ERROR",
          statusMessage: errorMessage,
        },
      });
    } catch (e) {
      this.logError('handleRetrieverError', e);
    }
  }
  async handleToolEnd(
    output: string,
    runId: string,
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`Tool end with ID: ${runId}`);

      this.handleOtelSpanEnd({
        runId,
        attributes: { output },
      });
    } catch (e) {
      this.logger.debug(e instanceof Error ? e.message : String(e));
    }
  }

  async handleToolError(
    err: ErrorLike,
    runId: string,
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Tool error ${errorMessage} with ID: ${runId}`);

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          level: "ERROR",
          statusMessage: errorMessage,
        },
      });
    } catch (e) {
      this.logError('handleToolError', e);
    }
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      this.logger.debug(`LLM end with ID: ${runId}`);
      const lastResponse =
        output.generations[output.generations.length - 1][
          output.generations[output.generations.length - 1].length - 1
        ];

      const llmUsage =
        this.extractUsageMetadata(lastResponse) ??
        output.llmOutput?.["tokenUsage"];
      const modelName = this.extractModelNameFromMetadata(lastResponse as unknown as GenerationWithMetadata);

      const usageDetails: Record<string, number | undefined> = {
        input_tokens:
          llmUsage?.input_tokens ??
          ("promptTokens" in llmUsage ? llmUsage?.promptTokens : undefined),
        output_tokens:
          llmUsage?.output_tokens ??
          ("completionTokens" in llmUsage
            ? llmUsage?.completionTokens
            : undefined),
        total_tokens:
          llmUsage?.total_tokens ??
          ("totalTokens" in llmUsage ? llmUsage?.totalTokens : undefined),
      };

      if (llmUsage && "input_token_details" in llmUsage) {
        for (const [key, val] of Object.entries(
          llmUsage["input_token_details"] ?? {},
        )) {
          if (typeof val === "number") {
            usageDetails[`input_${key}`] = val;

            const inputTokens = usageDetails["input_tokens"];
            if (typeof inputTokens === "number") {
              usageDetails["input_tokens"] = Math.max(0, inputTokens - val);
            }
          }
        }
      }

      if (llmUsage && "output_token_details" in llmUsage) {
        for (const [key, val] of Object.entries(
          llmUsage["output_token_details"] ?? {},
        )) {
          if (typeof val === "number") {
            usageDetails[`output_${key}`] = val;

            const outputTokens = usageDetails["output_tokens"];
            if (typeof outputTokens === "number") {
              usageDetails["output_tokens"] = Math.max(0, outputTokens - val);
            }
          }
        }
      }


      //let llm_response = {"role": "assistant", "content": lastResponse.text}

      const val = lastResponse as Generation & { message?: BaseMessage };

      const llmResponse = val.message ? this.extractChatMessageContent(val.message) : undefined;

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          messages: llmResponse ? [llmResponse] : [],
          model: modelName,
          usageDetails: usageDetails,
        },
      });
    } catch (e) {
      this.logError('handleLLMEnd', e);
    }
  }

  async handleLLMError(
    err: ErrorLike,
    runId: string,
    parentRunId?: string | undefined,
  ): Promise<void> {
    try {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.debug(`LLM error ${errorMessage} with ID: ${runId}`);

      // Azure has the refusal status for harmful messages in the error property
      // This would not be logged as the error message is only a generic message
      // that there has been a refusal
      const azureRefusalError = this.parseAzureRefusalError(err);

      this.handleOtelSpanEnd({
        runId,
        attributes: {
          level: "ERROR",
          statusMessage: errorMessage + azureRefusalError,
        },
      });
    } catch (e) {
      this.logError('handleLLMError', e);
    }
  }

  private startAndRegisterOtelSpan(params: {
    type?: mlflow.SpanType;
    runName: string;
    runId: string;
    parentRunId?: string;
    attributes: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    tags?: string[];
  }): mlflow.Span {
    const { type, runName, runId, parentRunId, attributes, metadata, tags } =
      params;

    // Ensure map doesn't grow unbounded
    this.ensureMapSize();

    const parentSpan = parentRunId &&  this.runMap.has(parentRunId)
              ? this.runMap.get(parentRunId)
              : undefined

    const joinedMetadata = this.joinTagsAndMetaData(tags, metadata);
    const inputs: Record<string, unknown> = { ...attributes };
    if (joinedMetadata !== undefined) {
      inputs.metadata = joinedMetadata;
    }

    const span = mlflow.startSpan({
      name: runName,
      spanType: type,
      inputs,
      parent: parentSpan
    });

    if(parentRunId){
      span.setAttribute("parentRunID", parentRunId)
    }

    this.runMap.set(runId, span);

    return span;
  }

  private handleOtelSpanEnd(params: {
    runId: string;
    attributes?: Record<string, unknown>
  }) {
    const { runId, attributes = {} } = params;

    const span = this.runMap.get(runId);

    if (!span) {
      this.logger.warn("Span not found in runMap. Skipping operation");

      return;
    }

    span.setOutputs({...attributes})
    span.setStatus(mlflow.SpanStatusCode.OK)

    span.end()

    this._lastTraceId = span.traceId;

    this.runMap.delete(runId);
  }

  private parseAzureRefusalError(err: ErrorLike): string {
    // Azure has the refusal status for harmful messages in the error property
    // This would not be logged as the error message is only a generic message
    // that there has been a refusal
    let azureRefusalError = "";
    if (typeof err == "object" && "error" in err) {
      try {
        azureRefusalError =
          "\n\nError details:\n" + JSON.stringify(err["error"], null, 2);
      } catch (serializationError) {
        this.logger.debug(`Failed to serialize Azure error: ${serializationError}`);
        azureRefusalError = "\n\nError details: [Unable to serialize error object]";
      }
    }

    return azureRefusalError;
  }

  private joinTagsAndMetaData(
    tags?: string[] | undefined,
    metadata1?: Record<string, unknown> | undefined,
    metadata2?: Record<string, unknown> | undefined,
  ): Record<string, unknown> | undefined {
    const finalDict: Record<string, unknown> = {};
    if (tags && tags.length > 0) {
      finalDict.tags = tags;
    }
    if (metadata1) {
      Object.assign(finalDict, metadata1);
    }
    if (metadata2) {
      Object.assign(finalDict, metadata2);
    }
    return Object.keys(finalDict).length > 0 ? finalDict : undefined;
  }

  /** Not all models supports tokenUsage in llmOutput, can use AIMessage.usage_metadata instead */
  private extractUsageMetadata(
    generation: Generation,
  ): UsageMetadata | undefined {
    try {
      const usageMetadata =
        "message" in generation &&
        (generation["message"] instanceof AIMessage ||
          generation["message"] instanceof AIMessageChunk)
          ? generation["message"].usage_metadata
          : undefined;

      return usageMetadata;
    } catch (err) {
      this.logger.debug(`Error extracting usage metadata: ${err}`);

      return;
    }
  }

  private extractModelNameFromMetadata(generation: GenerationWithMetadata): string | undefined {
    try {
      return generation.message?.response_metadata?.model_name;
    } catch (error) {
      this.logError('extractModelNameFromMetadata', error);
      return undefined;
    }
  }

  private extractChatMessageContent(
    message: BaseMessage,
  ): Record<string, unknown> {
    let response = undefined;
    
    if (message.getType() == "human") {
      response = { content: message.content, role: "user" };
    } else if (message.getType() == "ai") {
      response = { content: message.content, role: "assistant"};
    } else if (message.getType() == "system") {
      response = { content: message.content, role: "system" };
    } else if (message.getType() == "function") {
      response = {
        content: message.content,
        additional_kwargs: message.additional_kwargs,
        role: message.name,
      };
    } else if (message.getType() == "tool") {
      response = {
        content: message.content,
        additional_kwargs: message.additional_kwargs,
        role: "tool",
      };
    } else if (!message.name) {
      response = { content: message.content, role: "user"};
    } else {
      response = {
        role: message.name,
        content: message.content,
      };
    }
    if (
      message.additional_kwargs.function_call ||
      message.additional_kwargs.tool_calls
    ) {
      return { ...response, tool_calls: message.additional_kwargs.tool_calls };
    }
    return response;
  }
}
