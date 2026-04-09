const { handleHealthRequest } = require("./shared");

module.exports = async (req, res) => {
  handleHealthRequest(req, res);
};
