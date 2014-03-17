(function (root) {
    "use strict";

    var Q,
        SAT,
        runConsoleTests = false;

    if (typeof document !== "undefined") {
        Q = root.Q;
        SAT = root.SAT;
        document.addEventListener("DOMContentLoaded", function () {
            new SAT.ConsoleView(console);
            new SAT.HtmlView(document.getElementsByTagName("body")[0]);
        });
    }
    else if (typeof require !== "undefined") {
        SAT = require("../../simpleAsyncTester");
        Q = require("../../q");
        runConsoleTests = true;
    }

    var Promise = {
        delay: undefined,
        wrap: undefined,
        wrapError: undefined,
        defer: undefined
    };

    if (typeof WinJS !== "undefined") {
        Promise.delay = function (fulfillment, timeout) {
            return WinJS.Promise.timeout(timeout).then(function () {
                return WinJS.Promise.wrap(fulfillment);
            });
        };
        Promise.wrap = WinJS.Promise.wrap;
        Promise.wrapError = WinJS.Promise.wrapError;
        Promise.defer = function () {
            var resolve,
                reject,
                notify,
                promise = new root.WinJS.Promise(function (resolveIn, rejectIn, notifyIn) {
                    resolve = resolveIn;
                    reject = rejectIn;
                    notify = notifyIn;
                });

            return {
                promise: promise,
                resolve: resolve,
                reject: reject,
                notify: notify
            };
        }
    }
    else {
        Promise.defer = Q.defer;
        Promise.delay = Q.delay;
        Promise.wrap = Q;
        Promise.wrapError = Q.reject;
    }

    SAT.addTest("LazyPromise start with promise", function (console) {
        var count = 0,
            guard = new AsyncReentrancyGuard.LazyPromise(function () { return Promise.wrap(count++); }),
            index;

        for (index = 0; index < 3; ++index) {
            guard.settleAsync().then(function (result) {
                console.log(result + ", " + count);
                console.assert(result === 0);
                console.assert(count === 1);
            });
        }
    });

    SAT.addTest("LazyPromise end with promise", function (console) {
        var count = 0,
            guard = new AsyncReentrancyGuard.LazyPromise(),
            index;

        for (index = 0; index < 3; ++index) {
            guard.settleAsync().then(function (result) {
                console.log(result + ", " + count);
                console.assert(result === 0);
                console.assert(count === 1);
            });
        }

        guard.setPromiseFunction(function () { return Promise.wrap(count++); });
    });

    SAT.addTest("LazyPromise middle with promise", function (console) {
        var count = 0,
            guard = new AsyncReentrancyGuard.LazyPromise(),
            index;

        for (index = 0; index < 3; ++index) {
            guard.settleAsync().then(function (result) {
                console.log(result + ", " + count);
                console.assert(result === 0);
                console.assert(count === 1);
            });
        }

        guard.setPromiseFunction(function () { return Promise.wrap(count++); });

        for (index = 0; index < 3; ++index) {
            guard.settleAsync().then(function (result) {
                console.log(result + ", " + count);
                console.assert(result === 0);
                console.assert(count === 1);
            });
        }
    });

    SAT.addTest("PromiseSerializer no overlapping promise execution", function (console) {
        var guard = new AsyncReentrancyGuard.PromiseSerializer(),
            running = 0,
            index;

        for (index = 0; index < 3; ++index) {
            guard.startLastAsync(function () {
                return Promise.wrap().then(function () {
                    var defer = Promise.defer();
                    console.assert(running === 0);
                    ++running;
                    setTimeout(function () { defer.resolve(); }, 100);

                    return defer.promise;
                }).then(function () {
                    console.assert(running === 1);
                    --running;
                });
            });
        }

        return guard.startLastAsync(function () { return Promise.wrap(); });
    });

    SAT.addTest("PromiseSerializer runs despite previous promise failure", function (console) {
        var guard = new AsyncReentrancyGuard.PromiseSerializer(),
            running = 0,
            defer = Promise.defer(),
            ranAfterError = false;

        guard.startLastAsync(function () {
            return defer.promise.then(function () { console.log("defer completed."); });
        });
        guard.startLastAsync(function () {
            return Promise.wrap().then(function () {
                console.log("error function runs.");
                throw new Error("error");
            }).then(undefined, function(error) {});
        });
        guard.startLastAsync(function () {
            return Promise.wrap().then(function () {
                console.log("after error promise runs.");
                ranAfterError = true;
            });
        });

        defer.resolve();

        return guard.startLastAsync(function () {
            return Promise.wrap().then(function () {
                console.log("last promise runs.");
                console.assert(ranAfterError);
            });
        });
    });

    SAT.addTest("PromiseGate startIfIdleOrGetCurrentAsync collapses results when it should and doesn't when it shouldn't", function (console) {
        var count = 0,
            guard = new AsyncReentrancyGuard.PromiseGate(function () { return Promise.delay(count++, 100); }),
            index = 0;

        guard.startIfIdleOrGetCurrentAsync().then(function (result) {
            console.assert(0 === result);
            console.assert(1 === count);
        });
        return guard.startIfIdleOrGetCurrentAsync().then(function (result) {
            console.assert(0 === result);
            console.assert(1 === count);
        }).then(function () {
            guard.startIfIdleOrGetCurrentAsync().then(function (result) {
                console.assert(1 === result);
                console.assert(2 === count);
            });
            return guard.startIfIdleOrGetCurrentAsync().then(function (result) {
                console.assert(1 === result);
                console.assert(2 === count);
            });
        });
    });

    SAT.addTest("PromiseGate startIfIdleOrFailAsync fails appropriately", function (console) {
        var count = 0,
            guard = new AsyncReentrancyGuard.PromiseGate(function () { return Promise.delay(count++, 100); }),
            failCalled = false,
            index = 0;

        guard.startIfIdleOrFailAsync().then(function (result) {
            console.assert(0 === result);
            console.assert(1 === count);
        });
        return guard.startIfIdleOrFailAsync().then(function () {
            console.assert(false);
        }, function (error) {
            failCalled = true;
        }).then(function () {
            console.assert(failCalled);
        });
    });

    if (runConsoleTests) {
        new SAT.ConsoleView(console, SAT);
        SAT.runAsync().then(function () {
            console.log("done");
        },
        function (error) {
            console.log("Error in test tester: " + error);
        });
    }
})(this);