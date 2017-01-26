define(['jszip'], function(jszip) {
    //For XLSX library: JSZip library uses browserify which conflict with requirejs and does not exports JSZip as global variable
    "use strict";

    window.JSZip = jszip;
});