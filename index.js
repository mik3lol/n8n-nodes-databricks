// Register module aliases for development and production
const moduleAlias = require('module-alias');

// Add custom module resolvers
if (process.env.NODE_ENV === 'development') {
  moduleAlias.addAliases({
    '@utils': __dirname + '/utils'
  });
} else {
  moduleAlias.addAliases({
    '@utils': __dirname + '/dist/utils'
  });
}

// Register module aliases
moduleAlias();

// Export the package
module.exports = process.env.NODE_ENV === 'development' 
  ? require('./src/index')
  : require('./dist/index');