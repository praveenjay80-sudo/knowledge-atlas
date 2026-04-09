const { getNodeDetail, sendJson } = require("./shared");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const code = req.query?.code || "";
  const payload = getNodeDetail(code);
  if (!payload) {
    sendJson(res, 404, { error: "MSC 2020 code not found." });
    return;
  }

  sendJson(res, 200, payload);
};
