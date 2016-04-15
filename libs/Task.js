var self
var debug         = require('debug')('CloudCv.Task')
var fs            = require('fs')
var path          = require('path')
var http          = require('http')
var request       = require('request')
var querystring   = require('querystring')
var EventEmitter  = require('events').EventEmitter

function Task(opts) {
  if (typeof opts == 'undefined')
    opts = {}
  if (typeof opts.params == 'undefined')
    opts.params = {}

  self = this
  self.emitter = new EventEmitter()
  self.params = opts.params
  self.id = Math.floor(Math.random() * 9999)
  self.maxDimensions = opts.maxDimensions
  self.token = ''
  self.socketId = opts.socketId
  self.jobId = -1
  self.jobInfo = {}
  self.files = {}
  self.method = undefined
  self.outputCb = undefined
}

function run(method, files, cb) {
  debug('Run CloudCv task [id=' + self.id + ',method=' + method + ']')

  self.outputCb = cb
  self.files    = files
  self.method   = method

  var paramsData = {}
  paramsData['token']       = self.token
  paramsData['socketid']    = self.socketId
  paramsData['executable']  = self.method
  paramsData['exec_params'] = self.params

  doFormRequest(paramsData)
}

function doFormRequest(data) {
  var r = request
          .post(global.cloudcvBaseUrl + '/api/',
                function onFormRequest (err, httpResponse, body) {
                  if (err) {
                    throw(err)
                    return debug('Upload failed:', err)
                  }

                  debug('Upload successful!  Server responded with:', body)

                  if (typeof body != 'undefined' && body != '') {
                    try {
                      body = body.replace(/u'(?=[^:]+')/g, '"').replace(/'/g, '"').replace(/None/g, 'false').replace(/"{/g, '{').replace(/}"/g, '}')
                      // in the body there was a 'u' before any string, ' instead of " for keys and "None" for empty values
                      body = JSON.parse(body)
                    } catch (err) {
                      debug(err)
                      debug(body)
                    }
                  } else {
                    body = {}
                  }
                  self.emitter.emit('upload', { 'taskId': self.id, 'body': body })
                })

  var form = r.form()
  for (var i in data) {
    if (typeof data[i] == 'object') {
      data[i] = JSON.stringify(data[i])
      debug(data[i])
    }
    form.append(i, data[i])
  }
  for (var i in self.files) {
    var f = self.files[i]
    form.append(i, fs.createReadStream(f['path']))
  }
}

function obtainToken(cb) {
  debug('Asking for a token')

  http.get(global.cloudcvBaseUrl + '/classify/', function(res) {
    var cookie = res.headers['set-cookie'][0]
    var token = false
    var result = {}

    // Note: the following method is twice faster then a regex
    cookie.split(';').forEach(function(x){
        var arr = x.split('=');
        arr[1] && (result[arr[0]] = arr[1]);
    });
    for (var i in result) {
      if (i == 'csrftoken') {
        token = result[i]
        break
      }
    }
    cb(token)
  }).on('error', function(e) {
    debug("Got error: " + e.message)
    cb(false)
  })
}

Task.prototype.run = function(method, files, cb) {
  var self = this
  obtainToken(function onTokenRes(token) {
    if (!token) {
      throw ('token not found')
    } else {
      debug('Obtained token::' + token)
      self.token = token
      run(method, files, cb)
    }
  })
}
Task.prototype.setOutput = function(data) {
  var self = this
  if (typeof self.outputCb == 'function') {
    debug('Task with token ' + self.token + ' is setting output')
    self.outputCb(data)
    self.emitter.emit('done', {taskId: self.id})
  }
  else
    throw ('callback is mandatory')
}
Task.prototype.abort = function() {}

module.exports = Task