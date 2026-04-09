import shared from "./shared.js";
import { runLegacyHandler } from "./_adapter.mjs";

const { handleTaxonomyRequest } = shared;

export async function POST(request) {
  try {
    return await runLegacyHandler(request, handleTaxonomyRequest);
  } catch (error) {
    return Response.json(
      {
        error: error?.message || "Taxonomy handler crashed.",
      },
      { status: error?.statusCode || 500 },
    );
  }
}
