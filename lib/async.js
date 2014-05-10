var EventEmitter = require('events').EventEmitter;
var debug = require('./debug');

var __emptyFunction = function empty() {};

/**
 * Executes a callback after an emit chain has executed.
 * This function is used internally by 'asyncEmit' to process any callbacks
 * registered by the .ready() function.
 */
var __executeFinishCallback = function executeFinishCallback(callback, internals) {
  if (callback) {
    if (typeof callback === 'function') {
      var emitter = wrap_result.call(this, internals);
      callback.call(emitter, emitter);
    } else if (callback.emit && typeof callback.emit === 'function') {
      var emitter = wrap_result.call(this, internals);
      callback.emit('ready', emitter);
    }
  }
}

/**
 * The core async emit function.
 *
 * @param {Callback} fnReturn A callback function called in the final stage at return point.
 *                            If missing, the function will return a boolean, just as EventEmitter.prototype.emit.
 * @param {Object} _arguments Object to be used as an 'arguments' instance within the function.
 *
 */
var asyncEmit = function asyncEmit(fnReturn, __arguments) {
  var emitter = this;
  var type = __arguments[0];

  // Initialize variables and retrieve list of listeners for given type.
  var i = 0, listeners = emitter.listeners(type), len = listeners.length;
  
  //----- This section is copied from the native events library in nodeJS
  //----- and handles the 'error' event.
  // If there is no 'error' event listener then throw.
  if (type === 'error' && !len) {
    er = __arguments[1];
    if (emitter.domain) {
      if (!er)
        er = new Error('Uncaught, unspecified "error" event.');
      er.domainEmitter = emitter;
      er.domain = emitter.domain;
      er.domainThrown = false;
      emitter.domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      throw Error('Uncaught, unspecified "error" event.');
    }
    return false;
  }
  //----- End of copied section.
  
  // If we have any listeners for the given type.
  if (len) {
    // If emitter belongs to a domain, enter it.
    if (emitter.domain && emitter !== process)
      emitter.domain.enter();
    
    // Initialize additional variables.
    // asyncEmitter is a new object with the prototype set to 'this' instance.
     
    var asyncEmitter  = null // Reference to this emitter instance.
      , internals     = {}   // The object holding internal variables, used throughout the process and later wrappers.
      ;
    internals.eventType             = type;
    internals.nListeners            = len;
    internals.canCallNextListener   = true;
    internals.currentListenerIndex  = 0;
    internals.currentListener       = null;
    internals.queueAborted          = false;
    internals.waitingForCallback    = false;
    internals.emitHasFinished       = false;
    internals.args                  = [];
    internals.callbackFinish        = undefined;
    internals.nExecutedListeners    = 0;
      
    // Populate 'args' with the parameters passed to the event.
    if (__arguments.length > 1) {
      switch (__arguments.length) {
        case 2:
          // Fast for 1 parameter.
          internals.args.push(__arguments[1]);
          break;
        case 3:
          // Fast for 2 parameters.
          internals.args.push(__arguments[1], __arguments[2]);
          break;
        case 4:
          // Fast for 3 parameters.
          internals.args.push(__arguments[1], __arguments[2], __arguments[3]);
          break;
        default:
          // Slower, for any number of parameters. 
          // Creates a new array from 'arguments' object, removing the first item which is the event type.
          // Update 'args' array with the new array.
          internals.args.concat(Array.prototype.slice.call(__arguments, 1));
      }
    }
    
    var __buildAsyncEmitter = function () {
      var _emitter = Object.create(emitter);
      // Expose the event type.
      _emitter.event  = type;
      _emitter.next   = __next;
      _emitter.abort  = __abort;
      _emitter.wait   = __wait;
      return _emitter;
    };
    
    var __resetCurrentAsyncEmitter = function () {
      if (asyncEmitter) {
        asyncEmitter.next = asyncEmitter.abort = asyncEmitter.wait = __emptyFunction;
      }
    };
    
    var __finish = function () {
      // Reset the current emitter wrapper.
      __resetCurrentAsyncEmitter();

      if (!internals.emitHasFinished) {
        internals.emitHasFinished = true;
        
        // Exit the domain of the emitter.
        if (emitter.domain && emitter !== process)
            emitter.domain.exit();

        // Check for any callbacks for ready()
        if (internals.callbackFinish) {
          var _callback = internals.callbackFinish;
          internals.callbackFinish = null;
          __executeFinishCallback.call(emitter, _callback, internals);
        }
      }
    };
    
    // Define the additional functions, outside the loop in order to  optimize the emit call.
    // But do not set them to the asyncEmitter outside the loop, 
    //   in order to prevent overwriting by the listeners, which could pose security risks.
    

    var __onListenerFinish = function onListenerFinish() {
      // Reset the current async emitter.
      __resetCurrentAsyncEmitter();

      if (internals.waitingForCallback) {
        // Wait has been issued inside the listener, and abort() or next()
        // are still expected, but these will be disregarded since emitter has been reset.
        // Clear the waiting mark.
        internals.waitingForCallback = false;
      }
      // Call for a next listener.
      callNextListener();
    }
    
    /**
     * Pause the chain and wait for an abort or continue call.
     * Additional callback to call.
     *
     * NOTE: Calling .wait() is accepted only one time per listener. 
     *       Any further calls to .wait() are discarded.
     */
    var __wait = function wait(callback) {
      if (!internals.waitingForCallback) {
        // Mark that the chain is paused, until .abort or .next are called.
        internals.waitingForCallback = true;
        // Disable further calls to .wait inside the current listener.
        this.wait = __emptyFunction;
        // Reference to the current emitter object.
        var emitterAfterWait = this;

        if (callback && typeof callback === 'function') {
          // If a callback function is provided.
          
          // Build a new async emitter, for temporary use inside the callback.
          var tempEmitter = __buildAsyncEmitter();
          // Disable the temporary emitter's .wait function, 
          // because wait has already been called inside the current listener.
          tempEmitter.wait = __emptyFunction;
          
          // When calling emitter.abort() before the callback uses tempEmitter (.next or .abort),
          // then disable tempEmitter, since it's not needed.
          emitterAfterWait.abort = function someabort() {
            // Disable tempEmitter and disable .abort on the current emitter
            emitterAfterWait.abort = tempEmitter.abort = tempEmitter.next = __emptyFunction;
            // Do the abort of the chain.
            __abort.call(emitterAfterWait);
          };
          
          // When calling emitter.next() before the callback uses tempEmitter (.next or .abort),
          // then disable tempEmitter, since it's not needed.
          emitterAfterWait.next = function somenext() {
            // Disable tempEmitter and disable .next on the current emitter
            emitterAfterWait.next = tempEmitter.abort = tempEmitter.next = __emptyFunction;
            // Call for the next listener in the chain.
            __next.call(emitterAfterWait);
          };
          
          // Execute callback with the temporary async emitter and the onFinish() function.
          callback.call(tempEmitter, function onFinish() {
            if (arguments.length && !!arguments[0]) {
              // NOTE: acts just like abort()
              // If onFinish() is called with any argument that is not null, false, undefined, empty or 0
              // the assume it's an error indication and abort.
              // E.g. onFinish(true) || onFinish(1) || onFinish('true') || onFinish(new Error(..)) will always abort.
              tempEmitter.abort();
            } else {
              // NOTE: acts just like next()
              // onFinish called without parameter or with a false parameter.
              // E.g. onFinish() || onFinish(false) || onFinish(null) || onFinish(0) || onFinish('')
              tempEmitter.next();
            }
          }); // Done executing the callback.
        } else {
          // When no callback defined, just wait for .abort or .next on the emitter.
        }
      } else {
        // Already waiting for a callback. Disregard.
      }
    };
    
    /**
     * Abort the current chain.
     *
     * NOTE: Calling .abort() is accepted only one time per listener and chain. 
     *       Any further calls to .abort(), .wait() and .next() are discarded.
     */
    var __abort = function abort() {
      if (internals.canCallNextListener) {
        // Chain has not been aborted until now.
        internals.canCallNextListener = false;
        internals.queueAborted = true;
        
        __onListenerFinish();
        /*
        if (waitingForCallback) {
          // the chain has been paused by calling .wait
          __onListenerFinish();
        } else {
        }
        */
      } else {
        // Chain already aborted.
      }
    };
    
    /**
     * Finished with the listener, call on the next listener in chain.
     *
     * NOTE: Calling .next() is accepted only one time per listener. 
     *       Any further calls to .abort(), .wait() and .next() are discarded.
     */
    var __next = function next() {
      __onListenerFinish();
    }
    
    // Define the main loop.
    var callNextListener = function () {
      if (internals.canCallNextListener) {
        // Unless queue has finished or has been aborted.
        if (!internals.waitingForCallback) {
          // Reset 'currentListener' to avoid the possibility of reusing a previous listeners.
          internals.currentListener = null;
          if (internals.currentListenerIndex < len) {
            // There still is a listener in the queue.
            // Retrieve the listener in queue. Increment the current listener index.
            internals.currentListener = listeners[internals.currentListenerIndex++];
            
            // Prepare the asyncEmitter object, by resetting additional functions.
            // Needed in order to avoid any security breaks, such as when a listener overwrites
            // one or more of these additional functions.
            asyncEmitter = __buildAsyncEmitter();

            internals.nExecutedListeners++;
            // Call the listener, supplying the async emitter instance and the parameters in 'args' array.
            internals.currentListener.apply(asyncEmitter, internals.args);
            
            // Unless wait(), abort() or next() have been called inside the listener,
            // then continue with the next listener.
            callNextListener();
          } else {
            // no listeners left to call.
            // Mark queue as finished and call finish.
            internals.canCallNextListener = false;
            __finish();
          }
        } else {
          // Wait has been issued; do nothing.
          // Next call will come from .next()
        }
      } else {
        // Queue has been marked as finished.
        __finish();
      }
    };
    
    // Start the loop by calling the loop function on the first listener.
    callNextListener();
 
    // Finished with the given type.
  }

  // Final stage. Return results.  
  if (fnReturn) {
    // Used for the enhanced 'emit', which returns 'this' instance and the .ready additional functionality.
    return fnReturn.call(emitter, internals);
  } else {
    // Used for the 'emit' variant that, similarly to native EventEmitter.prototype.emit, returns a boolean.
    return (internals.nExecutedListeners ? true : false);
  }
}

/**
 * Function to wrap an emitter object with the .ready() function, based on the internals object.
 *
 * This function is used internally by 'asyncEmit' and 'emitObject'.
 */
var wrap_result = function wrap_result(internals) {
  var emitter = this;
  // Create the .ready() function.
  emitter.ready = function ready(callback) {
    if (internals.emitHasFinished) {
      // If the emit chain finished executing, call the callback immediatelly.
      if (callback) {
        __executeFinishCallback.call(emitter, callback, internals);
      }
    } else {
      // The emit chain has not finished yet.
      if (callback) {
        // Only if a callback has been provided.
        if (internals.callbackFinish) {
          // There already is a finish callback registered for this event chain.
          // Store a reference to the current callback.
          var _oldCallback = internals.callbackFinish;
          // Replace the chain's callback with a new callback function.
          internals.callbackFinish = function cbf() {
            // Execute the previously recorded callback.
            __executeFinishCallback.call(emitter, _oldCallback, internals);
            // Execute the newly provided callback.
            __executeFinishCallback.call(emitter, callback, internals);
          };
        } else {
          // No on finish callback registered yet.
          // Add the callback.
          internals.callbackFinish = callback;
        }
      }
    }
    // Return the wrapper emitter.
    return emitter;
  };
  // Add statistics and info to the .ready function.
  
  // Expose the event type for which the emit chain run or is running.
  emitter.ready.event = internals.eventType;
  // Whether the emit chain is still running.
  emitter.ready.running  = (!internals.emitHasFinished ? internals.canCallNextListener : false);
  // Whether the emit chain has been aborted.
  emitter.ready.aborted  = internals.queueAborted;
  // The number of listeners in the chain.
  emitter.ready.listeners= internals.nListeners;
  // The number of listeners in the chain that have been executed already.
  emitter.ready.executed = internals.nExecutedListeners;
  
  // return the wrapper emitter.
  return emitter;
};

/**
 * Allows for queue manipulation and async emitting, by exposing .wait(), .abort(), .next()
 *
 * Will return a reference to the emitter instance, wrapped with the .ready() functionality.
 *
 */
var emitObject = function emitObject() {
  var self   = this;
  var result = Object.create(this);
  asyncEmit.call(this, function onReturn(internals) {
    wrap_result.call(result, internals);
  }, arguments);
  return result;
}

/**
 * Using emitBool will use the async emit, but will always return a boolean, just how EventEmitter.prototype.emit returns.
 *
 * If none of the listeners use the async functionality, this acts just as the native EventEmitter.prototype.emit does.
 * Otherwise, it returns true if any listeners finished before the queue finished or was paused.
 */
var emitBool = function emitBool() {
  return emit_return(asyncEmit.call(this, null, arguments));
}

/**
 * The 'emit' function that will act as a replacement for EventEmitter.prototype.emit.
 */
var emit = function emit() {
  return emit_return(emitObject.apply(this, arguments));
}

/**
 * AsyncEmitter. An EventEmitter instance that uses the async 'emit' variant.
 */
var AsyncEmitter = function AsyncEmitter() {
  EventEmitter.call(this);
  return this;
}
// Define the prototype.
AsyncEmitter.prototype = Object.create(EventEmitter.prototype);
AsyncEmitter.prototype.constructor = AsyncEmitter;
// Assign the async emit function.
AsyncEmitter.prototype.emit = emit;

/**
 * Exports.
 *
 */
// expose the async emit.
module.exports = function () {
  return emit.apply(this, arguments);
}
// expose the async emit to emit also
module.exports.emit = emit;
// expose the async emit that returns an EventEmitter instance.
module.exports.emitObject = emitObject;
// expose the async emit that returns boolean, just as EventEmitter.prototype.emit
module.exports.emitBool = emitBool;
// expose the AsyncEmitter class, and its aliases 'Emitter' and 'EventEmitter'.
module.exports.AsyncEmitter = AsyncEmitter;
module.exports.Emitter      = AsyncEmitter;
module.exports.EventEmitter = AsyncEmitter;

/** 
 * The additional 'returns()' function, which can be overwritten to further customize or replace
 * what 'emit' will return.
 * Consider this as a way to post-process the results of the async emit.
 *
 * @param {AsyncEmitter} asyncResult  The result of  async 'emit'
 * @returns {Any} The return value that 'emit' should return (module.exports and AsyncEmitter.prototype.emit)
 */
var emit_return = module.exports.returns = function emit_return(asyncResult) {
  return asyncResult;
}