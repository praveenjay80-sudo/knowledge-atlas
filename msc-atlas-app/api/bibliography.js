const { generateGroundedBibliography, readJsonBody, sendJson } = require("./shared");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const payload = await generateGroundedBibliography({
      scheme: body.target_scheme || "msc",
      id: body.target_id || body.code || "",
      label: body.target_label || body.label || "",
      description: body.description || "",
      focus: body.focus || "",
      notes: body.notes || "",
      audience: body.audience || "graduate",
      maxEntries: Number.parseInt(body.max_entries || body.maxEntries || "10", 10),
    });
    sendJson(res, 200, payload);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unable to generate grounded bibliography." });
  }
};
