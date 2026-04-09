const { getRootNodes, sendJson } = require("./shared");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  sendJson(res, 200, {
    items: getRootNodes(),
  });
};
