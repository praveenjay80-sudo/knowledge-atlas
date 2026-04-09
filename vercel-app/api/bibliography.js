const { handleBibliographyRequest } = require("./shared");

module.exports = async (req, res) => {
  await handleBibliographyRequest(req, res);
};
