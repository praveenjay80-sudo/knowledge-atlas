module.exports = async (req, res) => {
  try {
    const { handleTaxonomyRequest } = require("./shared");
    await handleTaxonomyRequest(req, res);
  } catch (error) {
    res.statusCode = error?.statusCode || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: error?.message || "Taxonomy handler crashed.",
        stack: process.env.NODE_ENV === "development" ? error?.stack || "" : undefined,
      }),
    );
  }
};
