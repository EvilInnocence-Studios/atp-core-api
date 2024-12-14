import * as fs from 'fs';
import * as path from 'path';

// Automatically export all handlers from module handler files
const modulesPath = path.resolve(__dirname);
const moduleHandlerFiles = fs.readdirSync(modulesPath, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() &&
               fs.existsSync(path.join(modulesPath, entry.name, 'handlers.ts'))
  )
  .map((entry) => path.join(modulesPath, entry.name, 'handlers.ts'));

// Import and combine all module handlers
const moduleHandlers = {};
moduleHandlerFiles.forEach((file) => {
  const moduleExports = require(file);
  Object.assign(moduleHandlers, moduleExports);
});

// Export all handlers (including dynamically loaded ones)
export default moduleHandlers;
