FireIPC
=======

Addon that defines a simple TCP based inter-process communication protocol that
greasemonkey userscripts can use to send and receive messages to other processes
in the filesystem.

By default, it starts a TCP server in localhost:61155 in which newline-separated
(ASCII 10) JSON objects are sent and received. Valid double-quoted JSON strings
are also accepted. The special value `0` (zero as an integer) closes the
connection, this is useful to send simple messages with `netcat`:

    echo -e '"hello"\n0' | nc localhost 61155

This sends the JSON objects `"hello"` and `0`. Userscripts receive the first
one and the connection is closed with the second one.

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

Probably doing @require of a github /raw/ url for a fixed commit might help
keeping a stable API. Maybe.

Build
-----

 * Install the [firefox addon SDK][1]
 * Run the bin/activate script as indicated by the docs.
 * Run `cfx xpi`

[1]: https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/installation.html
