events-async
============

Asynchronous emit for [node](http://nodejs.org) event emitters.

## Installation
    $ npm install events-async

## Features
* Support asynchronous executions inside listeners, on emit.
* Can *pause*, *resume* or *abort* a chain during event execution.
* Does NOT modify any of the emitter properties, nor `EventEmitter.prototype`.
* Wraps around any object, not just EventEmitter - *Note: `.listeners()` method is required*.
* Provides both the `emit` method replacer and `AsyncEmitter` class.
* a `.ready()` method for when a chain finished processing.

## Exports
This module exposes the following properties:

* *(Function)* [**emit**](https://github.com/mpotra/events-async/wiki/exports.emit) - Replacement function for `EventEmitter.prototype.emit`, which enables the features of the library.
* *(Function)* [**emitBool**](https://github.com/mpotra/events-async/wiki/exports.emitBool) - Same as `.emit`, but will return a `boolean`.
* *(Class)* [**AsyncEmitter**](https://github.com/mpotra/events-async/wiki/AsyncEmitter#class-asyncemitter) - `EventEmitter` subclass that has the `.emit()` method replaced with the one provided by this library.
  * [Method: emit](https://github.com/mpotra/events-async/wiki/AsyncEmitter#emitteremitevent-arg1-arg2-)
* *(Class)* **Emitter** - Alias to `AsyncEmitter`.
* *(Class)* **EventEmitter** - Alias to `AsyncEmitter`.
* *(Function)* **returns** - Function used for post-processing the result returned by `.emit` and `.emitBool` exposed by this library.

### Aditional reference
* wrapper (inside listeners)
  * [wrapper.wait()](https://github.com/mpotra/events-async/wiki/wrapper.wait)
  * [wrapper.wait(callback)](https://github.com/mpotra/events-async/wiki/wrapper.wait#using-waitcallback-with-callback)
  * [wrapper.next()](https://github.com/mpotra/events-async/wiki/wrapper.next)
  * [wrapper.abort()](https://github.com/mpotra/events-async/wiki/wrapper.abort)
* emitResult wrapper
  * [emitResult.ready()](https://github.com/mpotra/events-async/wiki/emitResult.ready)
  * [emitResult.ready(callback)](https://github.com/mpotra/events-async/wiki/emitResult.ready#emitresultreadycallback)
  * [emitResult.ready(emitter)](https://github.com/mpotra/events-async/wiki/emitResult.ready#emitresultreadyreadyemitter)

## Usage
Quick example:
```javascript
var asyncEmitter = require('events-async');

var emitter = new EventEmitter();
// replace the emit method
emitter.emit = asyncEmitter.emit; // preferred over `emitter.emit = asyncEmitter`

// add some listeners
emitter.on('something', function listener1() {
    this.wait(); // pause the chain execution.
    var wrapper = this; // just a reference for later use.
    someAsyncFunction(function onAsyncFinished() {
        wrapper.next(); // execute next listener in chain. (line #9)
    });
});

emitter.on('something', function listener2() {
  // code will execute after 'onAsyncFinished' calls .next() [line #9]
});

// Now emit something
emitter.emit('something', someParameter);

// emit again, but this time do something after the chain finished
emitter.emit('something', someOtherParameter).ready(function onready() {
    if (this.ready.aborted) {
        // chain was aborted
    } else {
        // chain finished without being aborted
    }
});
```

[AsyncEmitter](https://github.com/mpotra/events-async/wiki/AsyncEmitter) example:
```javascript
// load the library
var AsyncEmitter = require('events-async').AsyncEmitter;
// create an emitter
var emitter = new AsyncEmitter();
// add some listeners
emitter.on('something', function listener1() {
  // do some stuff just like in the quick example
});
// emit something
emitter.emit('something');
```

Using .emit() without replacing the method:
```javascript
var emit = require('events-async').emit;

/**
 * same as
 * > emitter.emit = emit;
 * > emitter.emit('something', param1, param2, ...);
 */
emit.call(emitter, 'something', param1, param2, ...);
```

## Contact

* [Issues](https://github.com/mpotra/events-async/issues) for this repo
* [Wiki](https://github.com/mpotra/events-async/wiki) for this repo
* [@mpotra](https://twitter.com/mpotra) on Twitter
* [mpotra](https://github.com/mpotra) on GitHub
