function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

function isEmpty( el ){
    return !$.trim(el.html())
}

function isString(obj) {
    var getType = {};
    return obj && getType.toString.call(obj) == '[object String]';
}

if (typeof String.prototype.startsWith != 'function') {
    String.prototype.startsWith = function (str){
        return this.slice(0, str.length) == str;
    };
}

if(typeof String.prototype.trim != 'function') {
    String.prototype.trim = function (){
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

if(typeof String.prototype.splitWs != 'function') {
    String.prototype.splitWs = function (){
        String(this).replace(/[^\w\s]|_/g, function ($1) { return ' ' + $1 + ' ';}).replace(/[ ]+/g, ' ').split(' ');
    }
}

function pad(number, length) { 
    return (number+"").length >= length ? 
        number + "" : 
        pad("0" + number, length);
}

Object.size = function(obj) {
    var size = 0, key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) size++;
    }
    return size;
};

function getURLParameter(name) {
    return decodeURI(
        (RegExp(name + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1]
    );
}

function rgbToHex(rgb) {
    var rgbvals = /rgb\((.+),(.+),(.+)\)/i.exec(rgb);
    var rval = parseInt(rgbvals[1]);
    var gval = parseInt(rgbvals[2]);
    var bval = parseInt(rgbvals[3]);
    return '#' + (
            rval.toString(16) +
            gval.toString(16) +
            bval.toString(16)
    ).toUpperCase();
}

/*
function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
*/