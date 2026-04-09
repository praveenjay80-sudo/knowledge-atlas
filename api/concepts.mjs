import shared from "./shared.js";
import { runLegacyHandler } from "./_adapter.mjs";

const { handleConceptTreeRequest } = shared;

export async function POST(request) {
  try {
    return await runLegacyHandler(request, handleConceptTreeRequest);
  } catch (error) {
    return Response.json(
      {
        error: error?.message || "Concept handler crashed.",
      },
      { status: error?.statusCode || 500 },
    );
  }
}
