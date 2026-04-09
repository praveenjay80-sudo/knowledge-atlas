const { searchCatalog, sendJson } = require("./shared");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const query = req.query?.q || "";
  const limit = Number.parseInt(req.query?.limit || "18", 10);
  sendJson(res, 200, searchCatalog(query, Number.isFinite(limit) ? limit : 18));
};
