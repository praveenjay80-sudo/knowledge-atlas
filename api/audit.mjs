import shared from "./shared.js";
import { runLegacyHandler } from "./_adapter.mjs";

const { handleAuditRequest } = shared;

export async function POST(request) {
  try {
    return await runLegacyHandler(request, handleAuditRequest);
  } catch (error) {
    return Response.json(
      {
        error: error?.message || "Audit handler crashed.",
      },
      { status: error?.statusCode || 500 },
    );
  }
}
