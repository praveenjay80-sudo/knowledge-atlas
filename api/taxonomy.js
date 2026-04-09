const { handleTaxonomyRequest } = require("./shared");

module.exports = async (req, res) => {
  await handleTaxonomyRequest(req, res);
};
