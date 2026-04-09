module.exports = async (req, res) => {
  try {
    const { handleBibliographyRequest } = require("./shared");
    await handleBibliographyRequest(req, res);
  } catch (error) {
    res.statusCode = error?.statusCode || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: error?.message || "Bibliography handler crashed.",
        stack: process.env.NODE_ENV === "development" ? error?.stack || "" : undefined,
      }),
    );
  }
};
