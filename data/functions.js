var GM_callbacks = [];
unsafeWindow.rpc_emit = function(message){
  self.port.emit('GM_rpc_emit', message);
}

unsafeWindow.rpc_on = function(func){
  GM_callbacks.push(func);
}

self.port.on('GM_rpc_data', function(data) {
  for(var i in GM_callbacks){
    GM_callbacks[i](data);
  }
});
