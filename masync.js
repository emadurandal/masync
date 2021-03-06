//
//
//
//                               masync
//
//                           version 0.1.0
//
//             site: https://github.com/kontan/masync/
//
//
//
//
//                      The MIT License (MIT)
//
//             Copyright (c) 2013- Kon (http://phyzkit.net/)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
var masync;
(function (masync) {
    // Functor //
    function fmap(f, x) {
        return ap(pure(f), x);
    }
    masync.fmap = fmap;

    // Applicative //
    function pure(t) {
        return function (succ, fail) {
            return succ(t);
        };
    }
    masync.pure = pure;

    function ap(f, x) {
        return function (succ, fail) {
            var _f;
            var _x;
            var count = 0;
            function fin() {
                if (++count === 2)
                    succ(_f(_x));
            }
            f(function (g) {
                _f = g;
                fin();
            }, fail);
            x(function (r) {
                _x = r;
                fin();
            }, fail);
        };
    }
    masync.ap = ap;

    // Monad //
    function bind(x, f) {
        return function (succ, fail) {
            x(function (t) {
                return f(t)(succ, fail);
            }, fail);
        };
    }
    masync.bind = bind;

    function lift(f) {
        return function () {
            return fmap(function (xs) {
                return f.apply(undefined, xs);
            }, collect(Array.prototype.slice.call(arguments)));
        };
    }
    masync.lift = lift;

    function liftAsync(f) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return function (succ, fail) {
                collect(args)(function (_args) {
                    f.apply(undefined, _args)(succ, fail);
                }, fail);
            };
        };
    }
    masync.liftAsync = liftAsync;

    function series() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        xs = xs.slice(0);
        return function (succ, fail) {
            var _xs = xs.slice(0);
            var r = null;
            function run() {
                _xs.length == 0 ? succ(r) : _xs[0](function (_r) {
                    r = _r;
                    _xs.shift();
                    run();
                }, fail);
            }
            run();
        };
    }
    masync.series = series;

    function parallel() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        var args = xs.slice(0);
        return function (succ, fail) {
            collect(args)(function (_args) {
                return succ();
            }, fail);
        };
    }
    masync.parallel = parallel;

    function run() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        series.apply(undefined, xs)(function () {
        }, function (message) {
            throw new Error(message);
        });
    }
    masync.run = run;

    // Utils //
    // (>>)
    function next(a, b) {
        return bind(a, function () {
            return b;
        });
    }
    masync.next = next;

    function _pure_(x) {
        switch (typeof x) {
            case "string":
            case "number":
            case "boolean":
            case "object":
            case "undefined":
                return pure(x);
            default:
                return x;
        }
    }

    // inject and eject //
    function inject(f) {
        return function (succ, fail) {
            succ(f());
        };
    }
    masync.inject = inject;

    function eject(x, f) {
        return function (succ, fail) {
            x(function (result) {
                f(result);
                succ();
            }, fail);
        };
    }
    masync.eject = eject;

    // error handling ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    function fail(message) {
        return function (succ, fail) {
            fail(message);
        };
    }
    masync.fail = fail;

    function recover(defaultValue, xs) {
        defaultValue = _pure_(defaultValue);
        return function (succ, fail) {
            xs(succ, function () {
                defaultValue(function (_def) {
                    return succ(_def);
                }, fail);
            });
        };
    }
    masync.recover = recover;

    function capture(xs, callback) {
        return function (succ, fail) {
            xs(succ, function (message) {
                succ(callback(message));
            });
        };
    }
    masync.capture = capture;

    // control flow ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    masync.nop = pure(undefined);

    function cache(xs) {
        var value = undefined;
        var succeed = undefined;
        var listener = [];
        return function (succ, fail) {
            if (arguments.length == 0) {
                if (succeed != true)
                    throw new Error("The cache object is not evaluated or failed.");
                return value;
            } else if (typeof succeed === "undefined") {
                if (listener.length == 0) {
                    xs(function (v) {
                        value = v;
                        succeed = true;
                        listener.forEach(function (listener) {
                            return listener.succ(v);
                        });
                    }, function () {
                        succeed = false;
                        listener.forEach(function (listener) {
                            return listener.fail();
                        });
                    });
                }
                listener.push({ succ: succ, fail: fail });
            } else if (succeed) {
                succ(value);
            } else {
                fail();
            }
        };
    }
    masync.cache = cache;

    function fastest() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        return function (succ, fail) {
            var active = true;
            function _succ(result) {
                if (active) {
                    active = false;
                    succ(result);
                }
            }
            function _fail() {
                if (active) {
                    active = false;
                    fail();
                }
            }
            xs.forEach(function (x) {
                return x(_succ, _fail);
            });
        };
    }
    masync.fastest = fastest;

    function branch(main, sub) {
        return function (succ, fail) {
            var active = true;
            function side() {
                if (active) {
                    sub(side, fail);
                }
            }
            main(function (v) {
                active = false;
                succ(v);
            }, fail);
            side();
        };
    }
    masync.branch = branch;

    function when(x, ifthen, ifelse) {
        return function (succ, fail) {
            x(function (_x) {
                _x ? ifthen(succ, fail) : ifelse ? ifelse(succ, fail) : succ(undefined);
            }, fail);
        };
    }
    masync.when = when;

    function loop() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        function _loop(x) {
            return function (succ, fail) {
                (function f() {
                    x(function (_x) {
                        return f();
                    }, fail);
                })();
            };
        }
        return _loop(series.apply(undefined, xs));
    }
    masync.loop = loop;

    function times(cnt, block) {
        return count(cnt, function () {
            return block;
        });
    }
    masync.times = times;

    function count(count, block) {
        return function (succ, fail) {
            var i = 0;
            (function f(v) {
                i++ < count ? block(i)(f, fail) : succ(v);
            })(undefined);
        };
    }
    masync.count = count;

    function wait(seconds) {
        seconds = typeof (seconds) === "number" ? pure(seconds) : seconds;
        return function (succ, fail) {
            seconds(function (_seconds) {
                window.setTimeout(succ, 1000 * _seconds);
            }, fail);
        };
    }
    masync.wait = wait;

    function log(message) {
        return fmap(console.log.bind(console), _pure_(message));
    }
    masync.log = log;

    // (==)
    function equals(a, b) {
        return lift(function (xa, xb) {
            return xa == xb;
        })(a, b);
    }
    masync.equals = equals;

    function notEquals(a, b) {
        return lift(function (xa, xb) {
            return xa != xb;
        })(a, b);
    }
    masync.notEquals = notEquals;

    // boolean //
    function not(x) {
        return lift(function (y) {
            return !y;
        })(x);
    }
    masync.not = not;

    // number //
    function max() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        return lift(function (ys) {
            return Math.max.apply(undefined, ys);
        })(collect(xs));
    }
    masync.max = max;

    function min() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        return lift(function (ys) {
            return Math.min.apply(undefined, ys);
        })(collect(xs));
    }
    masync.min = min;

    function abs(x) {
        return lift(Math.abs)(x);
    }
    masync.abs = abs;

    // string //
    function toString(x) {
        return lift(function (x) {
            return x + "";
        })(x);
    }
    masync.toString = toString;

    function toUpperCase(s) {
        return lift(function (x) {
            return x.toUpperCase();
        })(s);
    }
    masync.toUpperCase = toUpperCase;

    function strcat() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        return lift(function (ys) {
            return ys.join("");
        })(collect(xs));
    }
    masync.strcat = strcat;

    // array //
    function collect(xs) {
        return function (succ, fail) {
            var values = new Array(xs.length);
            var count = 0;
            xs.forEach(function (x, i) {
                x(function (result) {
                    values[i] = result;
                    count++;
                    if (count == xs.length) {
                        succ(values);
                    }
                }, fail);
            });
        };
    }
    masync.collect = collect;

    function array() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        return collect(xs);
    }
    masync.array = array;

    function length(xs) {
        return fmap(function (xs) {
            return xs.length;
        }, xs);
    }
    masync.length = length;

    function at(i, xs) {
        i = typeof i === "number" ? pure(i) : i;
        return lift(function (i, xs) {
            return xs[i];
        })(i, xs);
    }
    masync.at = at;

    function putAt(i, x, xs) {
        i = typeof i === "number" ? pure(i) : i;
        return lift(function (i, x, xs) {
            xs[i] = x;
        })(i, x, xs);
    }
    masync.putAt = putAt;

    function concat() {
        var xs = [];
        for (var _i = 0; _i < (arguments.length - 0); _i++) {
            xs[_i] = arguments[_i + 0];
        }
        return lift(function (ys) {
            return [].concat(ys);
        })(collect(xs));
    }
    masync.concat = concat;

    function join(xs, separator) {
        if (typeof separator === "undefined") { separator = pure(","); }
        return lift(function (x, s) {
            return x.join(s);
        })(xs, separator);
    }
    masync.join = join;

    function map(f, xs) {
        function _map(f, xs) {
            return xs.map(f);
        }
        return lift(_map)(f, xs);
    }
    masync.map = map;

    function foldl(f, x, xs) {
        function _foldl(f, s, array) {
            for (var i = 0; i < array.length; i++) {
                s = f(s, array[i]);
            }
            return s;
        }
        return lift(_foldl)(f, x, xs);
    }
    masync.foldl = foldl;

    function and(xs) {
        return function (succ, fail) {
            return foldl(pure(function (a, b) {
                return a && b;
            }), pure(true), xs);
        };
    }
    masync.and = and;

    function or(xs) {
        return function (succ, fail) {
            return foldl(pure(function (a, b) {
                return a || b;
            }), pure(false), xs);
        };
    }
    masync.or = or;

    function get(url, chached) {
        if (typeof chached === "undefined") { chached = true; }
        url = typeof (url) === "string" ? pure(url) : url;
        return function (succ, fail) {
            url(function (result) {
                var xhr = new XMLHttpRequest();
                xhr.onload = function () {
                    succ(xhr.responseText);
                };
                xhr.onerror = function (e) {
                    e.preventDefault();
                    fail("masync.get: " + e.toString());
                };
                xhr.open("GET", result);
                if (!chached) {
                    xhr.setRequestHeader('Pragma', 'no-cache');
                    xhr.setRequestHeader('Cache-Control', 'no-cache');
                    xhr.setRequestHeader('If-Modified-Since', 'Thu, 01 Jun 1970 00:00:00 GMT');
                }
                xhr.send();
            }, fail);
        };
    }
    masync.get = get;

    function loadScript(url) {
        url = _pure_(url);
        return function (succ, fail) {
            url(function (_url) {
                var script = document.createElement("script");
                script.src = _url;
                script.addEventListener("load", function () {
                    succ(script);
                });
                script.addEventListener("error", fail);
            }, fail);
        };
    }
    masync.loadScript = loadScript;

    function getImage(url) {
        url = _pure_(url);
        return function (succ, fail) {
            url(function (_url) {
                var img = new Image();
                img.src = url;
                img.addEventListener("load", function () {
                    succ(img);
                });
                img.addEventListener("error", fail);
            }, fail);
        };
    }
    masync.getImage = getImage;

    // DOM integration //////////////////////////////////////////////////////////////////////////////
    function waitForMouseDown(element) {
        return function (succ, fail) {
            var listener = function () {
                element.removeEventListener("mousedown", listener);
                succ();
            };
            element.addEventListener("mousedown", listener);
        };
    }
    masync.waitForMouseDown = waitForMouseDown;

    function setTextContent(element, content) {
        return lift(function (_content) {
            element.textContent = _content;
        })(_pure_(content));
    }
    masync.setTextContent = setTextContent;

    // generators integration ///////////////////////////////////////////////////////////////////////////////
    function generate(generator, x) {
        var value;
        x(function (t) {
            setTimeout(function () {
                try  {
                    generator.send(t);
                } catch (e) {
                    if (!(e instanceof StopIteration))
                        throw e;
                }
            }, 0);
        }, function () {
            throw new Error();
        });
        return function () {
            return value;
        };
    }
    masync.generate = generate;

    // jquery integration ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    function resolve(promise) {
        return promise.then.bind(promise);
    }
    masync.resolve = resolve;

    function promise(async) {
        return new jQuery.Deferred(function (def) {
            async(def.resolve.bind(def), def.reject.bind(def));
        }).promise();
    }
    masync.promise = promise;

    function worker(scriptPath, arg) {
        function _fork(scriptPath, _arg) {
            return function (succ, fail) {
                var worker = new Worker(scriptPath);
                worker.onmessage = function (e) {
                    succ(e.data);
                };
                worker.postMessage(_arg);
            };
        }
        return liftAsync(_fork)(_pure_(scriptPath), _pure_(arg));
    }
    masync.worker = worker;

    function wrap(f) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return function (succ, fail) {
                collect(args)(function (_args) {
                    _args.push(function (err, data) {
                        return err ? fail() : succ(data);
                    });
                    f.apply(undefined, _args);
                }, fail);
            };
        };
    }
    masync.wrap = wrap;

    function peel(f) {
        return function () {
            throw new Error();
        };
    }
    masync.peel = peel;

    (function (fs) {
        function readFile(fileName, options) {
            var fs = require("fs");
            return masync.wrap(fs.readFile.bind(fs))(_pure_(fileName), masync.pure(options));
        }
        fs.readFile = readFile;
    })(masync.fs || (masync.fs = {}));
    var fs = masync.fs;
})(masync || (masync = {}));

var jQuery;
(function (jQuery) {
})(jQuery || (jQuery = {}));
