var emit = require('./../index');

var EventEmitter = require('events').EventEmitter;

var e = new EventEmitter();

console.log('** Replace the \'emit\' function for the emitter.');
/**
 * We could use:
 *  e.emit = emit;
 *  
 * It works just the same, but this this way we use the function that is not polluted with other module stuff.
 * So probably:
 *  var emit = require('events-emit').emit;
 *
 * would be preferred.
 */
e.emit = emit.emit;

console.log('** Add some listeners to the emitter.');
e.on('event1', function g1() {
  console.log('g1: called with arguments:', Array.prototype.slice.call(arguments));
});

e.on('event1', function g2() {
  var emitter = this; // store the wrapper reference to 'e';
  console.log('g2: pausing the chain (making it async)');
  this.wait();
  var args = Array.prototype.slice.call(arguments);
  setTimeout(function () {
    console.log('g2: after 10 ms, continue chain');
    console.log('btw, the arguments were:', args);
    emitter.next();
  }, 10);
  console.log('g2: this will run before calling .next()');
  console.log('g2: also, the .emit() should now return, because the chain is now async.');
});

e.on('event1', function g3() {
  var self = this;
  console.log('g3: another way to use .wait()');
  this.wait(function doWait(cbFinish) {
    setTimeout(function () {
      console.log('g3: after 10ms, abort the chain');
      cbFinish(true); // same as self.abort()
      
      self.abort() // chain already aborted. will no do nothing
      self.next() // no point, the chain has already been aborted, so this will do nothing.
      cbFinish(); // same as self.next()
      
      self.wait(function() {
        // This will do nothing, since the chain is already aborted at line #30 above.
        console.log('Will not run');
      });
    }, 10);
  });
});

e.on('event1', function g4() {
  console.log('g4: will never emit. chain already aborted');
});

console.log('** Finished preparing the emitter. Now emit.');

var result = e.emit('event1', 'myparam1', true);
console.log('returned after e.emit() but the chain is still running');
console.log('registering a listener to ready(), while .ready.running = ' + Boolean(result.ready.running).toString());
result.ready(function onready(emitter) {
  // emitter === this
  console.log('Now \'' + this.ready.event + '\' has finished.');
  console.log('Listeners registered:', this.ready.listeners);
  console.log('Listeners executed:', this.ready.executed);
  console.log('Chain aborted:', (this.ready.aborted ? 'yes' : 'no'));
  console.log('Is chain still running?', (this.ready.running ? 'yes': 'no'));
});