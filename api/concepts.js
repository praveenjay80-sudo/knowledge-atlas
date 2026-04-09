const { handleConceptTreeRequest } = require("./shared");

module.exports = async (req, res) => {
  await handleConceptTreeRequest(req, res);
};
