import shared from "./shared.js";
import { runLegacyHandler } from "./_adapter.mjs";

const { handleExplainRequest } = shared;

export async function POST(request) {
  try {
    return await runLegacyHandler(request, handleExplainRequest);
  } catch (error) {
    return Response.json(
      {
        error: error?.message || "Explanation handler crashed.",
      },
      { status: error?.statusCode || 500 },
    );
  }
}
