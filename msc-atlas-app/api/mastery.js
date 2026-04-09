const { generateMasteryGuide, readJsonBody, sendJson } = require("./shared");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const payload = await generateMasteryGuide({
      scheme: body.target_scheme || "msc",
      id: body.target_id || body.code || "",
      label: body.target_label || body.label || "",
      description: body.description || "",
      focus: body.focus || "",
      audience: body.audience || "undergraduate",
    });
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to generate mastery guide." });
  }
};
