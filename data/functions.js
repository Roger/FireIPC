document.addEventListener("fireipc_handshake",
  function handshake(event){
    // ignore self messages
    if(event.detail.sender == "addon") return;

    self.port.emit("handshake", event.detail);
    // HandShake started, stop listening for new handshakes in this worker
    document.removeEventListener("fireipc_handshake", handshake, false);
  }, false);


self.port.on("handshake_accept", function(message){
  var name = message.name;
  var uuid = message.uuid;

  // start listening in the new channel
  document.addEventListener("fireipc_"+message.uuid, function(event){
    // ignore self messages
    if(event.detail.sender == "addon") return;
    self.port.emit("fireipc_send", {
                     "name": name,
                     "uuid": uuid,
                     "detail": event.detail
                   });
  });

  // start receiving messages from addon in this channel
  self.port.on("fireipc_receive", function(message) {
    var ev = CustomEvent("fireipc_" + uuid, {"detail": {
      "msg": message,
      "sender": "addon"
    }});
    document.dispatchEvent(ev);
  });

  // notify the user script that the handshake is accepted
  var ev = CustomEvent("fireipc_handshake", {"detail": {
    "accept": true,
    "sender": "addon"
  }});
  document.dispatchEvent(ev);
});
