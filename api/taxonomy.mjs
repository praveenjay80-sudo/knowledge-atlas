import shared from "./shared.js";

const { handleTaxonomyRequest } = shared;

export default async function handler(req, res) {
  try {
    await handleTaxonomyRequest(req, res);
  } catch (error) {
    res.statusCode = error?.statusCode || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: error?.message || "Taxonomy handler crashed.",
      }),
    );
  }
}
