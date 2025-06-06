const moduleAlias = require('module-alias');

// Add custom module resolvers
moduleAlias.addAliases({
  '@utils': __dirname + '/utils'
});

// Register module aliases
moduleAlias();

module.exports = require('./index');