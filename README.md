FireIPC
=======

Addon that defines a simple TCP based inter-process communication protocol that
greasemonkey userscripts can use to send and receive messages to other processes
in the filesystem.

By default, it starts a TCP server in localhost:61155 in which newline-separated
(ASCII 10) JSON objects are sent and received.

An userscript API is provided which can be @require'd. Example usage:

    var fipc = new FireIPC();
    fipc.setup(function(ready){
      if(!ready){
        console.log("Error!");
        return;
      }
      fipc.listen(function(msg){
        console.log(msg);
      })
      fipc.emit({"data": "hello world!"});
    });

At the moment there's no authentication or filtering of messages - every message
is broadcasted to every listener on both sides. For this reason the API is
considered unstable, at least until we decide wtf to do with that.

The protocol is unlikely to change so probably doing @require of a github /raw/
url for a fixed commit might help keeping a stable API. Maybe.

Build
-----

 * Install the [firefox addon SDK](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/installation.html)
 * Run the bin/activate script as indicated by the docs.
 * Run `cfx xpi`
