# AsyncReentrancyGuard
A set of helpers to avoid reentrancy when using promises. An object exposing an async method implemented with a chain of promises means that code may be able to use that object again during the promise chain. The state of that object may need to be protected against such reentrancy and so this libary provides helpers to do that.

## Include in project
In the browser or Windows Web Apps include with a script tag which defines a SAT property off the window object:

    <script src="asyncReentrancyGuard.js"></script>

In Node.JS use your normal require statement:

    var ARG = require("./asyncReentrancyGuard");

## Scenarios
All of the usage scenarios are around an async API that cannot have multiple outstanding requests. 

### Fail concurrent requests
Suppose you have a `takePhotoAsync` method that asks the user if they want to take a photo, then uses a physical camera and can take many seconds to complete. Because there is only one physical camera and only one user prompt is displayed at a time, there can be only one takePhotoAsync request in progress at one time. Until the first `takePhotoAsync` request's promise settles all concurrent calls to the API should fail. You can use `PromiseGuard.startIfIdleOrFailAsync` to accomplish this.

	function Camera {
		var takePhotoGuard = new AsyncReentrancyGuard.PromiseGate(function innerTakePhotoAsync() {
			var deferral = Q.defer();
			// ...
			return deferral.promise;
		});

		this.takePhotoAsync = function() {
			return takePhotoGuard.startIfIdleOrFailAsync(function() { return Q.reject("Only one call to takePhotoAsync allowed at one time."); });
		};
	}

### Coallesce concurrent requests
Instead of failing concurrent requests as in the previous example perhaps subsequent concurrent requests can be satisfied by the current outstanding request. Use `PromiseGate.startIfIdleOrGetCurrentAsync` for this.

	function BadExampleInNeedOfAnUpdate {
		var fooGuard = new AsyncReentrancyGuard.PromiseGate(function innerFooAsync() {
			var deferral = Q.defer();
			// ...
			return deferral.promise;
		});

		this.fooAsync = function() {
			return fooGuard.startIfIdleOrGetCurrentAsync();
		}
	}


### Serialize requests
Alternatively you may want concurrent requests to be satisifed serially. Use `PromiseSerializer.startLastAsync` to schedule a promise to run once everything previously scheduled via that PromiseSerializer is complete.

	function OtherBadExample {
		var exampleGuard = new AsyncReentrancyGuard.PromiseSerializer();

		this.fooAsync = function() {
			return exampleGuard.startLastAsync(function() { 
				var deferral = Q.defer();
				// ...
				return deferral.promise;
			});
		}

		this.barAsync = function() {
			return exampleGuard.startLastAsync(function() {
				var deferral = Q.defer();
				// ...
				return deferral.promise;
			});
		}
	}

### Run once and cache
A slightly different scenario is one in which the response is always the same and all that is needed is a single promise that all callers share and that eventually holds the cached result.

	function WordMatcher {
		var dictionaryLazyPromise = new AsyncReentrancyGuard.LazyPromise(function() {
			var deferral = Q.defer();
			// ...
			return deferral.promise;
		});

		this.getDictionaryAsync = function() {
			return dictionaryLazyPromise.settleAsync();
		}
	}
