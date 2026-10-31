/**
 * @omega/mcp-gateway — stdio transport
 *
 * Newline-delimited JSON-RPC: each input line is one JSON request,
 * each response is written as one JSON line. Unparseable lines get a
 * -32700 parse-error response with id null. Notifications (which the
 * gateway answers with null) produce no output line.
 *
 * Creator: David Charles Bourassa
 */

import { createInterface } from "node:readline";

import { JSON_RPC_ERROR_CODES, type Gateway, type JsonRpcResponse } from "./jsonrpc.js";

export async function runStdioGateway(
  gateway: Gateway,
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<void> {
  const rl = createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    let request: unknown;
    try {
      request = JSON.parse(trimmed) as unknown;
    } catch {
      const response: JsonRpcResponse = {
        jsonrpc: "2.0",
        id: null,
        error: { code: JSON_RPC_ERROR_CODES.PARSE_ERROR, message: "Parse error" },
      };
      output.write(`${JSON.stringify(response)}\n`);
      continue;
    }

    const response = await gateway.handle(request);
    if (response !== null) {
      output.write(`${JSON.stringify(response)}\n`);
    }
  }
}
