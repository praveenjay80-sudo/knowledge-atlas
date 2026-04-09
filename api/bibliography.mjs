import shared from "./shared.js";
import { runLegacyHandler } from "./_adapter.mjs";

const { handleBibliographyRequest } = shared;

export async function POST(request) {
  try {
    return await runLegacyHandler(request, handleBibliographyRequest);
  } catch (error) {
    return Response.json(
      {
        error: error?.message || "Bibliography handler crashed.",
      },
      { status: error?.statusCode || 500 },
    );
  }
}
