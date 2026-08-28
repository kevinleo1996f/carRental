const path = require('path');
const YAML = require('yamljs');

module.exports = YAML.load(path.join(__dirname, '../../../openapi.yaml'));
