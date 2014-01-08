(function($) {
    var fullScreenApi = {
        supportsFullScreen : false,
        nonNativeSupportsFullScreen : false,
        isFullScreen : function() {
            return false;
        },
        requestFullScreen : function() {
        },
        cancelFullScreen : function() {
        },
        fullScreenEventName : '',
        prefix : ''
    }, browserPrefixes = 'webkit moz o ms khtml'.split(' ');

    // check for native support
    if (typeof document.cancelFullScreen != 'undefined') {
        fullScreenApi.supportsFullScreen = true;
    } else {
        // check for fullscreen support by vendor prefix
        for ( var i = 0, il = browserPrefixes.length; i < il; i++) {
            fullScreenApi.prefix = browserPrefixes[i];

            if (typeof document[fullScreenApi.prefix + 'CancelFullScreen'] != 'undefined') {
                fullScreenApi.supportsFullScreen = true;

                break;
            }
        }
    }

    // update methods to do something useful
    if (fullScreenApi.supportsFullScreen) {
        fullScreenApi.fullScreenEventName = fullScreenApi.prefix + 'fullscreenchange';

        fullScreenApi.isFullScreen = function() {
            switch (this.prefix) {
            case '':
                return document.fullScreen;
            case 'webkit':
                return document.webkitIsFullScreen;
            default:
                return document[this.prefix + 'FullScreen'];
            }
        }
        fullScreenApi.requestFullScreen = function(el) {
            return (this.prefix === '') ? el.requestFullScreen() : el[this.prefix + 'RequestFullScreen']();
        }
        fullScreenApi.cancelFullScreen = function(el) {
            return (this.prefix === '') ? document.cancelFullScreen() : document[this.prefix + 'CancelFullScreen']();
        }
    } else if (typeof window.ActiveXObject !== "undefined") { // IE.
        fullScreenApi.nonNativeSupportsFullScreen = true;
        fullScreenApi.requestFullScreen = fullScreenApi.requestFullScreen = function(el) {
            var wscript = new ActiveXObject("WScript.Shell");
            if (wscript !== null) {
                wscript.SendKeys("{F11}");
            }
        }
        fullScreenApi.isFullScreen = function() {
            return document.body.clientHeight == screen.height && document.body.clientWidth == screen.width;
        }
    }
    // jQuery plugin
    if (typeof $ != 'undefined') {
        $.fn.requestFullScreen = function() {
            return this.each(function() {
                var el = $(this)[0];
                console.log(el);
                if (fullScreenApi.supportsFullScreen) {
                    fullScreenApi.requestFullScreen(el);
                }
            });
        };
        
        $.fn.cancelFullScreen = function() {
            return this.each(function() {
                var el = $(this)[0];
                if (fullScreenApi.supportsFullScreen) {
                    fullScreenApi.cancelFullScreen(el);
                }
            });
        };
        
        $.fn.isFullScreen = function() {
            if (fullScreenApi.supportsFullScreen) {
                return fullScreenApi.isFullScreen();
            }
        };
    }

    // export api
    window.fullScreenApi = fullScreenApi;
})(jQuery);
