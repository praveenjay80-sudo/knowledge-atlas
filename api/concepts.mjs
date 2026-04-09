import shared from "./shared.js";

const { handleConceptTreeRequest } = shared;

export default async function handler(req, res) {
  try {
    await handleConceptTreeRequest(req, res);
  } catch (error) {
    res.statusCode = error?.statusCode || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: error?.message || "Concept handler crashed.",
      }),
    );
  }
}
