"use strict";

const {Cu,Cc,Ci} = require("chrome");
const tabs = require("tabs");
var {NetUtils} = Cu.import("resource://gre/modules/NetUtil.jsm");

const data = require('self').data;

exports.main = function() {
  var workers = [];
  var outputs = [];

  require("sdk/tabs").on("ready", function(tab){
    var worker = tab.attach({
      contentScriptFile: (data.url('functions.js')),
    });
    workers.push(worker);
    worker.port.on("GM_rpc_emit", function(message){
      for(var i in outputs){
        try {
          outputs[i].write(message, message.length);
        } catch(e) {
          console.log("Error" + e.result + ": " + e.message);
        }
      }
    });
  });

  try  {
    var serverSocket = Cc["@mozilla.org/network/server-socket;1"]
            .createInstance(Ci.nsIServerSocket);
    serverSocket.init(4242, true, -1);

    serverSocket.asyncListen(
      {
        onSocketAccepted: function(server, transport) {
          var sout = transport.openOutputStream(0, 0, 0);
          var instream = transport.openInputStream(0, 0, 0);
          var sin = Cc["@mozilla.org/binaryinputstream;1"].
              createInstance(Ci.nsIBinaryInputStream);
          sin.setInputStream(instream);

          var out = "Connected\n";
          sout.write(out, out.length);
          outputs.push(sout);

          var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(
            Ci.nsIInputStreamPump);
          pump.init(sin, -1, -1, 0, 0, false);

          pump.asyncRead(
            {
            onStartRequest: function(request, context) {
              dump("Start!");
            },
            onStopRequest: function(request, context, result) {
              dump("Stop!");
            },
            onDataAvailable: function (request, context, stream, offset, count){
                var data = NetUtil.readInputStreamToString(stream, count);
                dump("DATA: " + data + "\n");
                for(var i in workers){
                  var worker = workers[i];
                  try {
                    worker.port.emit("GM_rpc_data", data);
                  } catch(e){
                    console.log("Error" + e.result + ": " + e.message);
                  }
                }
              }
            }, null);
        },
        onStopListening: function() {
          dump("Stopped Listening\n");
        }
      }
    );

  } catch (e){
      console.log("Error" + e.result + ": " + e.message);
      return e;
  } return null;
}
