var self
const debug         = require('debug')('CloudCv')
const fs            = require('fs')
const path          = require('path')
const http          = require('http')
const request       = require('request')
const querystring   = require('querystring')
const SocketClient  = require('./SocketClient')
const Task          = require('./Task')
const utils         = require('./Utils')
const EventEmitter  = require('events').EventEmitter

var latestTask
var tasks = []

const socketHost = 'cloudcv.org'
const socketPort = 80

global.cloudcvBaseUrl = 'http://cloudcv.org'
global.uploadDir = __dirname + '/tmp/'

function CloudCv() {
  debug('Initing CloudCv')

  self = this
  self.emitter = new EventEmitter()

  if (!self.socket) {
    self.socket = new SocketClient()
    self.socket.emitter.on('socketId',    onSocketId)
    self.socket.emitter.on('jobId',       onJobId)
    self.socket.emitter.on('name',        onName)
    self.socket.emitter.on('done',        onDone)
    self.socket.emitter.on('jobInfo',     onJobInfo)
    self.socket.emitter.on('data',        onData)
    self.socket.emitter.on('picture',     onPicture)
    self.socket.emitter.on('mat',         onMat)
    self.socket.emitter.on('requestData', onRequestData)
    self.socket.emitter.on('exit',        onExit)
    self.socket.emitter.on('error',       onSocketError)

    self.socket.connect({
      host: socketHost,
      port: socketPort
    })
  }
}

function onSocketId(e) {
  debug('Obtained socketId::' + self.socket.id)
  self.emitter.emit('onSocketId')
}

function onTaskUpload(e) {
  debug('onTaskUpload')
  var taskId = e.taskId
  var resBody = e.body
  var task = getTaskByTaskId(taskId)
  task.jobId = resBody.jobid
  task.jobInfo = resBody
  debug('The task with id ' + taskId + ' has uploaded the files')
}

function onTaskDone(e) {
  debug('onTaskDone')
  debug(e)
  removeTask(e.taskId)
}

function onJobId(e) {
  debug('onJobId')
  debug(e)
  var val = e.value
}

function onName(e) {
  debug('onName')
  debug(e)

  var val = e.value
    // TODO: Sometimes the latestTask is not ready, plus, check if the emit is disabled on the python version
    //var method = latestTask.method
    //self.socket.client.emit('send_message', method)
    //console.log('#### LATEST TASK ####')
    //console.log(latestTask.id)
}

function onDone(e) {
  debug('onDone')
  debug(e)

    /* Maybe this is not working properly */
  var method = latestTask.method
  self.socket.client.emit('send_message', method)
}

function onJobInfo(e) {
  debug('onJobInfo')

  var val = e.value
  var token = val.token
  var task = getTaskByToken(token)

  if (task) {
    task.jobId = val.jobid
    task.jobInfo = val
    latestTask = task
  } else {
    debug('Task not found')
  }
  debug('job info received')
}

function onData(e) {
  debug('onData')

  if (e.value != '') {
    var val = JSON.parse(e.value)
    for (var i in val) {
      if (typeof i == 'string') {
        debug('Looking for ' + i)
        var task = getTaskByFilename(i)
        if (task) {
          debug('Using task with token ' + task.token)
          return task.setOutput(val)
        }
      }
    }
  }
}

function onPicture(e) {
  debug('onPicture')

  var val = e.value
  var jobid = val.match(/anonymous\/(.*)\/results/)[1]

  debug('Looking for task with jobid ' + jobid)
  var task = getTaskByJobId(jobid)

  if (task) {
    debug('Using task with jobid ' + task.jobId)
    return task.setOutput({
      status: 'ok',
      'dest': global.cloudcvBaseUrl + val
    })
  } else {
    debug('Task not found')
  }
}

function onMat(e) {
  debug('onMat')

  var val = e.value
  var dest = path.join(global.resultsDir, self.socket.id + '.txt')
  var file = fs.createWriteStream(dest);
  var request = http.get(global.cloudcvBaseUrl + val, function(res) {
    res.pipe(file);
    file.on('finish', function() {
      file.close();
      debug('File Saved: ' + dest)
    });
  }).on('error', function(err) {
    fs.unlink(dest);
  });
}

function onRequestData(e) {
  debug(e)
    // do nothing
}

function onExit(e) {
  debug(e)
    // do nothing
}

function onSocketError(e) {
  debug(e)
  var val = e.value
}

function getTaskByIndex(index) {
  return tasks[index]
}

function getTaskByFilename(filename) {
  for (var i in tasks) {
    var t = tasks[i]
    var files = t.files
    for (var j in files) {
      if (files[j].path.indexOf('/' + filename) > -1) {
        debug('Found ' + filename + ' in ' + files[j].path + ', returning task with token ' + t.token)
        return t
      }
    }
  }
  return undefined
}

function getTaskByTaskId(taskId) {
  for (var i in tasks) {
    var t = tasks[i]
    if (taskId == t.id) return t
  }
  return undefined
}

function getTaskByJobId(jobId) {
  for (var i in tasks) {
    var t = tasks[i]
    if (jobId == t.jobId) return t
  }
  return undefined
}

function getTaskByToken(token) {
  for (var i in tasks) {
    var t = tasks[i]
    if (token == t.token) return t
  }
  return undefined
}

function removeTask(id) {
  debug('removing task with id ' + id)
  for (var i in tasks) {
    var t = tasks[i]
    if (id == t.id) {
      tasks.splice(i, 1)
      return true
    }
  }
  return false
}

CloudCv.prototype.exit = function() {
  debug('Exiting CloudCv')
  if (this.socket && this.socket.connected) this.socket.disconnect()
}
CloudCv.prototype.getStatus = function() {
  if (this.socket.token == '') {
    return {
      status: 'error',
      code: CloudCv.ERRORS.NO_SOCKET_TOKEN,
      message: 'The Cloud is not ready yet. Please, retry in few seconds.'
    }
  }
  if (this.socket.id == -1) {
    return {
      status: 'error',
      code: CloudCv.ERRORS.NO_SOCKET_ID,
      message: 'There are some unexpected issues. Please, retry later. We are sorry.'
    }
  }
  return {
    status: 'ok',
    code: CloudCv.STATUS.OK
  }
}
CloudCv.prototype.classify = function(files, areImagedata, cb) {
  debug('Called classify method')

  var self = this
  var status = this.getStatus()
  if (status.code != CloudCv.STATUS.OK) {
    debug('Socket not ready, waiting for it...')
    if (status.code == CloudCv.ERRORS.NO_SOCKET_ID || status.code == CloudCv.ERRORS.NO_SOCKET_TOKEN) {
      this.emitter.on('onSocketId', function onSocketReady() {
        debug('Socket ready. Retry...')
        self.classify(files, areImagedata, cb)
      })
    }
    return false
  }

  var task = new Task({
    token: this.socket.token,
    socketId: this.socket.id
  })

  tasks.push(task)
  task.emitter.on('upload', onTaskUpload)
  task.emitter.on('done', onTaskDone)

  if (areImagedata) {
    var _files = files
    var files = []
    utils.saveImageData(_files,
      function onFile(destPath) {
        files.push({'path': destPath})
    }, function onError(err) {
      cb({}, 'something wrong just happened saving the file')
    })
  }

  task.run('classify', files, cb)
}
CloudCv.prototype.imageStitch = function(files, areImagedata, cb) {
  debug('Called image stitch method')

  var self = this
  var status = this.getStatus()
  if (status.code != CloudCv.STATUS.OK) {
    debug('Socket not ready, waiting for it...')
    if (status.code == CloudCv.ERRORS.NO_SOCKET_ID || status.code == CloudCv.ERRORS.NO_SOCKET_TOKEN) {
      this.emitter.on('onSocketId', function onSocketReady() {
        debug('Socket ready. Retry...')
        self.imageStitch(files, areImagedata, cb)
      })
    }
    return false
  }

  var task = new Task({
    token: this.socket.token,
    socketId: this.socket.id,
    params: {
      "warp": "plane"
    }
  })
  tasks.push(task)
  task.emitter.on('upload', onTaskUpload)
  task.emitter.on('done', onTaskDone)

  if (areImagedata) {
    var _files = files
    var files = []
    utils.saveImageData(_files,
      function onFile(destPath) {
        files.push({'path': destPath})
    }, function onError(err) {
      cb({}, 'something wrong just happened saving the file')
    })
  }
  task.run('ImageStitch', files, cb)
}
CloudCv.prototype.objectDetection = function(files, areImagedata, cb) {
  debug('Called object detection method')

  var self = this
  var status = this.getStatus()
  if (status.code != CloudCv.STATUS.OK) {
    debug('Socket not ready, waiting for it...')
    if (status.code == CloudCv.ERRORS.NO_SOCKET_ID || status.code == CloudCv.ERRORS.NO_SOCKET_TOKEN) {
      this.emitter.on('onSocketId', function onSocketReady() {
        debug('Socket ready. Retry...')
        self.objectDetection(files, areImagedata, cb)
      })
    }
    return false
  }

  var models = 'all'
    // for doc.: https://github.com/batra-mlp-lab/pcloudcv/wiki/Config-File
  var task = new Task({
    token: this.socket.token,
    socketId: this.socket.id,
    params: {
      "Models": models
    }
  })
  tasks.push(task)
  task.emitter.on('upload', onTaskUpload)
  task.emitter.on('done', onTaskDone)

  if (areImagedata) {
    var _files = files
    var files = []
    utils.saveImageData(_files,
      function onFile(destPath) {
        files.push({'path': destPath})
    }, function onError(err) {
      cb({}, 'something wrong just happened saving the file')
    })
  }
  task.run('VOCRelease5', files, cb)
}
CloudCv.prototype.features = function(files, areImagedata, cb) {
  debug('Called Features method')

  var self = this
  var status = this.getStatus()
  if (status.code != CloudCv.STATUS.OK) {
    debug('Socket not ready, waiting for it...')
    if (status.code == CloudCv.ERRORS.NO_SOCKET_ID || status.code == CloudCv.ERRORS.NO_SOCKET_TOKEN) {
      this.emitter.on('onSocketId', function onSocketReady() {
        debug('Socket ready. Retry...')
        self.features(files, areImagedata, cb)
      })
    }
    return false
  }

  var task = new Task({
    token: this.socket.token,
    socketId: this.socket.id,
    params: {
      "name": "decaf",
      "verbose": "2"
    }
  })
  tasks.push(task)
  task.emitter.on('upload', onTaskUpload)
  task.emitter.on('done', onTaskDone)

  if (areImagedata) {
    var _files = files
    var files = []
    utils.saveImageData(_files,
      function onFile(destPath) {
        files.push({'path': destPath})
    }, function onError(err) {
      cb({}, 'something wrong just happened saving the file')
    })
  }
  task.run('features', files, cb)
}

CloudCv.ERRORS = CloudCv.STATUS = {}
CloudCv.ERRORS.NO_SOCKET_ID = 0
CloudCv.ERRORS.NO_SOCKET_TOKEN = 1
CloudCv.ERRORS.UNKOWN = 2
CloudCv.STATUS.OK = -1

module.exports = CloudCv