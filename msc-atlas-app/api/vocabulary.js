const { lookupControlledVocabulary, sendJson } = require("./shared");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const code = req.query?.code || "";
    const payload = await lookupControlledVocabulary(code);
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to load controlled vocabulary." });
  }
};
