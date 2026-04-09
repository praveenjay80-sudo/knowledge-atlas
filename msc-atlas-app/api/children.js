const { getChildren, getNodeDetail, sendJson } = require("./shared");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  const code = req.query?.code || "";
  const parent = getNodeDetail(code);
  if (!parent) {
    sendJson(res, 404, { error: "MSC 2020 code not found." });
    return;
  }

  sendJson(res, 200, {
    parent,
    items: getChildren(code),
  });
};
