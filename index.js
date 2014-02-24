// This file kicks things off
// It initializes the api and web controllers and starts the static web service
// and sockets.

var express = require('express');
var io = require('socket.io');
var sockets;
var app = express();
var server = require('http').createServer(app);
var slash = require('express-slash');
var multipart = require('connect-multiparty');
var multiparty = multipart();
var config = require('./lib/config');
var modules = require('./lib/modules.js');
var middleware = config.get('middleware');
var settings = config.get('expressConfig') || [];
var load = [ 'lib', 'adapters', 'components', 'controllers', 'models', 'api'];

var value, i, z;

// Load all the modules
// All of the modules are then accessible via /lib/modules.js, for example:
//   ---
//   var modules = require('lib/modules.js');
//   module.adapters.nedb
//   ---
// Would give you access to the nedb adapter

for (i=0, z=load.length; i<z; i++){
  modules.load(load[i]);
}

// Set CORS policies
// Pulls settings from /config.js

app.use(modules.lib.cors);

// Basic express config

app.enable('strict routing');
app.use(express.logger(config.get('expressLogging')));
app.use(express.cookieParser());
app.use(express.cookieSession({ secret: config.get('secret'), cookie: { maxAge: 60 * 60 * 1000 }}));
app.use(express.json());
app.use(express.urlencoded());
app.use(app.router);
app.use(slash());

// Serve static assets
app.use(express.static(config.get('env.publicHTTP') || __dirname + 'public/src'));

// Set custom Express config
if (settings.length) {
  modules.lib.stdout('title','LOADING EXPRESS SETTINGS');

  for (i=0, z=settings.length; i<z; i++) {
    if (Array.isArray(settings[i]) && settings[i].length) {
      value = settings[i][1] || null;
      app.set(settings[i][0], value);
      modules.lib.stdout('output', 'EXPRESS SETTING Applied: ' + settings[i][0] + '=' + value);
    }
  }
}

// Initialize custom middleware
// These can be set in the /config.js file 'middleware' property by assigning
// the corresponding /components/{name}.js, {name} as an array member

if (middleware.length) {
  modules.lib.stdout('title','LOADING MIDDLEWARE');
  for (i=0, z=middleware.length; i<z; i++) {
    if (modules.components.hasOwnProperty(middleware[i])) {
      // All is good, apply the component
      app.use(modules.components[middleware[i]]);
      modules.lib.stdout('output', 'MIDDLEWARE Applied: ' + middleware[i]);
    } else {
      // No component available
      modules.lib.stdout('error', 'ADAPTER Missing: ' + middleware[i]);
    }
  }
}

// Process API calls
// Calls the appropriate /api/{file}.js on HTTP req, ensures that controller is
// in place and properly specified and calls appropriate controller method

app.all('/api/:entity/*', multiparty, modules.lib.api.process);

// Listen on sockets
// Simply starts Socket.io over the server

modules.lib.stdout('title', 'STARTING SOCKETS');
sockets = io.listen(server);
modules.lib.socketio.setIO(sockets);

// Initialize controllers
// Loads up each of the controllers, binds them to their specified data sources
// and runs any initialization methods

modules.lib.controllers();

// Listen on app
// Starts the app service over config'd port

server.listen(config.get('env.port'));
modules.lib.stdout('title', 'SERVER RUNNING');
modules.lib.stdout('output', 'PORT: '+config.get('env.port'));

// Start a new console section for log output

modules.lib.stdout('title', 'LOGGING OUTPUT');
