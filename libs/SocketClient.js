// the CloudCv Socket class. It's in charge to communicate with the remote server
// Note: the socket.io-client version should be the same of the CloudCV server (actually socket.io-client@0.9.16)
var self
var debug         = require('debug')('CloudCv.SocketClient')
var io            = require('socket.io-client')
var fs            = require('fs')
var path          = require('path')
var http          = require('http')
var EventEmitter  = require('events').EventEmitter

function SocketClient() {
  self = this
  self.id = -1
  self.client = null
  self.emitter = new EventEmitter()
}
function onConnect() {
  debug('Socket connected')
  self.client.emit('getsocketid', 'socketid')
}
function onResponse(message) {
  message = message[0]

  if ('socketid' in message && self.id < 0) {
    self.id = message['socketid']
    self.emitter.emit('socketId')
  }

  if ('jobid' in message) {
    self.emitter.emit('jobId', {'label': 'jobId', 'value': message['jobid']})
  }

  if ('name' in message) {
    debug(message['name'])
    self.emitter.emit('name', {'label': 'name', 'value': message['name']})
  }

  if ('done' in message) {
    self.emitter.emit('done', {'label': 'done', 'value': message['done']})
  }

  if ('jobinfo' in message) {
    debug('Received information regarding the current job')
    debug(message['jobinfo'])
    self.emitter.emit('jobInfo', {'label': 'jobInfo', 'value': message['jobinfo']})
  }

  if ('data' in message) {
    debug('Data Received from Server')
    debug(message['data'])
    self.emitter.emit('data', {'label': 'data', 'value': message['data']})
  }

  if ('picture' in message) {
    debug('Picture Received from Server')
    debug(message['picture'])
    self.emitter.emit('picture', {'label': 'picture', 'value': message['picture']})
  }

  if ('mat' in message) {
    debug('Mat Received from Server')
    debug(message['mat'])
    self.emitter.emit('mat', {'label': 'mat', 'value': message['mat']})
  }

  if ('request_data' in message) {
    debug('Data request from Server')
    self.client.emit('send_message', 'data')
    self.emitter.emit('requestData', {'label': 'requestData', 'value': true})
  }

  if ('exit' in message) {
    debug(message['exit'])
    self.emitter.emit('exit', {'label': 'exit', 'value': true})
  }
}
function onError(err) {
  debug('Socket error')
  self.emitter.emit('error', {'label': 'error', 'value': err})
}

SocketClient.prototype.connect = function(opts) {
  debug('Socket connecting')

  var protocol = 'http';
  var domain  = opts.host;
  var port    = opts.port;
  var options = {
    'max reconnection attempts' : 2,
    'reconnection delay'        : 2000,
    'transports'            : [
      'websocket','htmlfile','xhr-polling','jsonp-polling'
    ]
  }

  this.client = io.connect(protocol + '://' + domain + ':' + port, options);
  this.client.on('connect', function(){
    debug("Connected", arguments)
    onConnect(arguments)
  });
  this.client.on('connecting', function(){
    debug("Connecting", arguments)
  });
  this.client.on('connect_failed', function(){
    debug("Connect Failed", arguments)
    onError(arguments)
  });
  this.client.on('message', function(){
    onResponse(arguments)
  });
  this.client.on('reconnecting', function(){
    debug("Reconnecting", arguments)
  });
  this.client.on('reconnect_failed', function(){
    debug("Reconnecting failed", arguments)
    onError(arguments)
  });
  this.client.on('connect_error', function(){
    debug("Error", arguments)
    onError(arguments)
  });
  this.client.on('close', function(){
    debug("Server Closed", arguments)
  });
  this.client.on('disconnect', function () {
    debug("Disconnected", arguments)
  });
}
SocketClient.prototype.disconnect = function() {
  debug('Socket disconnect')
  this.client.disconnect()
}

module.exports = SocketClient