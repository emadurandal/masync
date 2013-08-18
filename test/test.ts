/// <reference path="../masync.ts" />

var getAndLog = (path, time)=>masync.series(
    masync.wait(time),
    masync.bind(masync.get(path), masync.log)
);

var a = getAndLog("a.txt", 1000);
var b = getAndLog("b.txt",  500);
var c = getAndLog("c.txt",  300);
var d = getAndLog("d.txt", 1000);

masync.run(
    masync.parallel(a, masync.series(b, c)),
    d
);
