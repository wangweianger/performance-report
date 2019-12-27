/*!
 * performance-report Javascript Library 1.0.0
 * https://github.com/wangweianger/web-report-sdk
 * Date : 2018-04-18
 * auther :zane
 */
if (typeof require === 'function' && typeof exports === "object" && typeof module === "object") {
    module.exports = Performance
} else {
    window.Performance = Performance
}

window.ERRORLIST = [];
window.ADDDATA = {};
Performance.addError = function (err) {
    err = {
        method: 'GET',
        msg: err.msg,
        n: 'js',
        data: {
            col: err.col,
            line: err.line,
            resourceUrl: err.resourceUrl
        }
    }
    ERRORLIST.push(err)
}
Performance.addData = function (fn) { fn && fn(ADDDATA) };

function randomString(len) {
    len = len || 10;
    var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz123456789';
    var maxPos = $chars.length;
    var pwd = '';
    for (let i = 0; i < len; i++) {
        pwd = pwd + $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd + new Date().getTime();
}

// web msgs report function
function Performance(option, fn) {
    try {
        let filterUrl = ['/api/v1/report/web', 'livereload.js?snipver=1', '/sockjs-node/info'];
        let opt = {
            // 上报地址
            domain: 'http://localhost/api',
            // 脚本延迟上报时间
            outtime: 300,
            // ajax请求时需要过滤的url信息
            filterUrl: [],
            // 是否上报页面性能数据
            isPage: true,
            // 是否上报ajax性能数据
            isAjax: true,
            // 是否上报页面资源数据
            isResource: true,
            // 是否上报错误信息
            isError: true,
            // 提交参数
            add: {},
        }
        opt = Object.assign(opt, option);
        opt.filterUrl = opt.filterUrl.concat(filterUrl);
        let conf = {
            //资源列表 
            resourceList: [],
            // 页面性能列表
            performance: {},
            // 错误列表
            errorList: [],
            // 页面fetch数量
            fetchNum: 0,
            // 页面fetch总数量
            fetLength: 0,
            // 页面ajax信息
            ajaxMsg: {},
            // 是否有fetch
            haveFetch: false,
            // 来自域名
            preUrl: document.referrer && document.referrer !== location.href ? document.referrer : '',
            // 当前页面
            page: '',
        }
        // error default
        let errordefo = {
            t: '',
            n: 'js',
            msg: '',
            data: {}
        };

        let beginTime = new Date().getTime()
        let loadTime = 0
        let fetchTime = 0

        // error上报
        if (opt.isError) _error();

        // 绑定onload事件
        addEventListener("load", function () {
            loadTime = new Date().getTime() - beginTime
            getLargeTime();
        }, false);

        // 执行fetch重写
        if (opt.isAjax || opt.isError) _fetch();

        // 获得markpage
        function markUser() {
            let markUser = sessionStorage.getItem('ps_markUser') || '';
            let result = {
                markUser: markUser,
                isFristIn: false,
            };
            if (!markUser) {
                markUser = randomString();
                sessionStorage.setItem('ps_markUser', markUser);
                result.markUser = markUser;
                result.isFristIn = true;
            }
            return result;
        }

        // 获得Uv
        function markUv() {
            const date = new Date();
            let markUv = localStorage.getItem('ps_markUv') || '';
            const datatime = localStorage.getItem('ps_markUvTime') || '';
            const today = date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate() + ' 23:59:59';
            if ((!markUv && !datatime) || (date.getTime() > datatime * 1)) {
                markUv = randomString();
                localStorage.setItem('ps_markUv', markUv);
                localStorage.setItem('ps_markUvTime', new Date(today).getTime());
            }
            return markUv;
        }

        // 资源过滤
        function filterResource() {
            let reslist = conf.resourceList;
            let filterUrl = opt.filterUrl;
            let newlist = [];
            if (reslist && reslist.length && filterUrl && filterUrl.length) {
                for (let i = 0; i < reslist.length; i++) {
                    let begin = false;
                    for (let j = 0; j < filterUrl.length; j++) {
                        if (reslist[i]['name'].indexOf(filterUrl[j]) > -1) {
                            begin = true;
                            break;
                        }
                    }
                    if (!begin) newlist.push(reslist[i])
                }
            }
            conf.resourceList = newlist;
        }

        // report date
        // @type  1:页面级性能上报  2:页面ajax性能上报  3：页面内错误信息上报
        function reportData(type = 1) {
            setTimeout(() => {
                if (opt.isPage) perforPage();
                if (opt.isResource || opt.isAjax) perforResource();
                if (ERRORLIST && ERRORLIST.length) conf.errorList = conf.errorList.concat(ERRORLIST)
                let w = document.documentElement.clientWidth || document.body.clientWidth;
                let h = document.documentElement.clientHeight || document.body.clientHeight;

                const markuser = markUser();

                let result = {
                    time: new Date().getTime(),
                    addData: ADDDATA,
                    markUser: markuser.markUser,
                    markUv: markUv(),
                    type: type,
                    url: location.href,
                }

                // 过滤
                filterResource();

                if (type === 1) {
                    // 1:页面级性能上报
                    result = Object.assign(result, {
                        preUrl: conf.preUrl,
                        errorList: conf.errorList,
                        performance: conf.performance,
                        resourceList: conf.resourceList,
                        isFristIn: markuser.isFristIn,
                        screenwidth: w,
                        screenheight: h,
                    })
                } else if (type === 2) {
                    // 2:页面ajax性能上报
                    result = Object.assign(result, {
                        resourceList: conf.resourceList,
                        errorList: conf.errorList,
                    })
                } else if (type === 3) {
                    // 3：页面内错误信息上报
                    result = Object.assign(result, {
                        errorList: conf.errorList,
                        resourceList: conf.resourceList,
                    })
                }

                result = Object.assign(result, opt.add)
                fn && fn(result)
                if (!fn && window.fetch) {
                    fetch(opt.domain, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        type: 'report-data',
                        body: JSON.stringify(result)
                    })
                }
                // 清空无关数据
                Promise.resolve().then(() => { clear() });
            }, opt.outtime)
        }

        //比较onload与ajax时间长度
        function getLargeTime() {
            if (conf.page !== location.href) {
                // 页面级性能上报
                if (conf.haveFetch && loadTime && fetchTime) {
                    console.log(`loadTime:${loadTime},fetchTime:${fetchTime}`)
                    reportData(1)
                } else if (!conf.haveFetch && loadTime) {
                    console.log(`loadTime:${loadTime}`)
                    reportData(1)
                }
            } else {
                // 单页面内ajax上报
                if (conf.haveFetch && fetchTime) {
                    console.log(`fetchTime:${fetchTime}`)
                    reportData(2)
                }
            }
        }

        // 统计页面性能
        function perforPage() {
            if (!window.performance) return;
            let timing = performance.timing
            conf.performance = {
                // DNS解析时间
                dnst: timing.domainLookupEnd - timing.domainLookupStart || 0,
                //TCP建立时间
                tcpt: timing.connectEnd - timing.connectStart || 0,
                // 白屏时间  
                wit: timing.responseStart - timing.navigationStart || 0,
                //dom渲染完成时间
                domt: timing.domContentLoadedEventEnd - timing.navigationStart || 0,
                //页面onload时间
                lodt: timing.loadEventEnd - timing.navigationStart || 0,
                // 页面准备时间 
                radt: timing.fetchStart - timing.navigationStart || 0,
                // 页面重定向时间
                rdit: timing.redirectEnd - timing.redirectStart || 0,
                // unload时间
                uodt: timing.unloadEventEnd - timing.unloadEventStart || 0,
                //request请求耗时
                reqt: timing.responseEnd - timing.requestStart || 0,
                //页面解析dom耗时
                andt: timing.domComplete - timing.domInteractive || 0,
            }
        }

        // 统计页面资源性能
        function perforResource() {
            if (!window.performance || !window.performance.getEntries) return false;
            let resource = performance.getEntriesByType('resource')

            let resourceList = [];
            if (!resource && !resource.length) return resourceList;

            resource.forEach((item) => {
                if (!opt.isAjax && (item.initiatorType == 'xmlhttprequest' || item.initiatorType == 'fetchrequest')) return;
                if (!opt.isResource && (item.initiatorType != 'xmlhttprequest' && item.initiatorType !== 'fetchrequest')) return;
                let json = {
                    name: item.name,
                    method: 'GET',
                    type: item.initiatorType,
                    duration: item.duration.toFixed(2) || 0,
                    decodedBodySize: item.decodedBodySize || 0,
                    nextHopProtocol: item.nextHopProtocol,
                }
                const name = item.name ? item.name.split('?')[0] : '';
                const ajaxMsg = conf.ajaxMsg[name] || '';
                if (ajaxMsg) {
                    json.method = ajaxMsg.method || 'GET'
                    json.type = ajaxMsg.type || json.type
                    json.decodedBodySize = json.decodedBodySize || ajaxMsg.decodedBodySize;
                }
                resourceList.push(json)
            })
            conf.resourceList = resourceList
        }

        // 拦截fetch请求
        function _fetch() {
            if (!window.fetch) return;
            const _fetch = fetch
            window.fetch = function () {
                const result = fetArg(arguments)
                if (result.type !== 'report-data') {
                    clearPerformance()
                    const url = result.url ? result.url.split('?')[0] : '';
                    conf.ajaxMsg[url] = result;
                    conf.fetLength = conf.fetLength + 1;
                    conf.haveFetch = true
                }
                return _fetch.apply(this, arguments)
                    .then((res) => {
                        if (result.type === 'report-data') return res;
                        getFetchTime('success')
                        try {
                            const url = res.url ? res.url.split('?')[0] : '';
                            res.clone().text().then(data => { if (conf.ajaxMsg[url]) conf.ajaxMsg[url]['decodedBodySize'] = data.length; })
                        } catch (e) { }
                        return res
                    })
                    .catch((err) => {
                        if (result.type === 'report-data') return;
                        getFetchTime('error')
                        //error
                        const defaults = Object.assign({}, errordefo);
                        defaults.t = new Date().getTime();
                        defaults.n = 'fetch'
                        defaults.msg = 'fetch request error';
                        defaults.method = result.method
                        defaults.data = {
                            resourceUrl: result.url,
                            text: err.stack || err,
                            status: 0
                        }
                        conf.errorList.push(defaults)
                        return err
                    });
            }
        }

        // fetch arguments
        function fetArg(arg) {
            let result = { method: 'GET', type: 'fetchrequest' }
            let args = Array.prototype.slice.apply(arg)

            if (!args || !args.length) return result;
            try {
                if (args.length === 1) {
                    if (typeof (args[0]) === 'string') {
                        result.url = args[0]
                    } else if (typeof (args[0]) === 'object') {
                        result.url = args[0].url
                        result.method = args[0].method
                    }
                } else {
                    result.url = args[0]
                    result.method = args[1].method || 'GET'
                    result.type = args[1].type || 'fetchrequest'
                }
            } catch (err) { }
            return result;
        }

        // 拦截js error信息
        function _error() {
            // img,script,css,jsonp
            window.addEventListener('error', function (e) {
                let defaults = Object.assign({}, errordefo);
                defaults.n = 'resource'
                defaults.t = new Date().getTime();
                defaults.msg = e.target.localName + ' is load error';
                defaults.method = 'GET'
                defaults.data = {
                    target: e.target.localName,
                    type: e.type,
                    resourceUrl: e.target.href || e.target.currentSrc || e.target.src,
                };
                if (e.target != window) conf.errorList.push(defaults)
            }, true);
            // js
            window.onerror = function (msg, _url, line, col, error) {
                let defaults = Object.assign({}, errordefo);
                setTimeout(function () {
                    col = col || (window.event && window.event.errorCharacter) || 0;
                    defaults.msg = error && error.stack ? error.stack.toString() : msg
                    defaults.method = 'GET'
                    defaults.data = {
                        resourceUrl: _url,
                        line: line,
                        col: col
                    };
                    defaults.t = new Date().getTime();
                    conf.errorList.push(defaults);
                    // 上报错误信息
                    if (conf.page === location.href && !conf.haveFetch) reportData(3);
                }, 0);
            };
            window.addEventListener('unhandledrejection', function (e) {
                const error = e && e.reason
                const message = error.message || '';
                const stack = error.stack || '';
                // Processing error
                let resourceUrl, col, line;
                let errs = stack.match(/\(.+?\)/)
                if (errs && errs.length) errs = errs[0]
                errs = errs.replace(/\w.+[js|html]/g, $1 => { resourceUrl = $1; return ''; })
                errs = errs.split(':')
                if (errs && errs.length > 1) line = parseInt(errs[1] || 0);
                col = parseInt(errs[2] || 0)
                let defaults = Object.assign({}, errordefo);
                defaults.msg = message;
                defaults.method = 'GET';
                defaults.t = new Date().getTime();
                defaults.data = {
                    resourceUrl: resourceUrl,
                    line: col,
                    col: line
                };
                conf.errorList.push(defaults);
                if (conf.page === location.href && !conf.haveFetch) reportData(3);
            })
            // 重写console.error
            const oldError = console.error;
            console.error = function (e) {
                let defaults = Object.assign({}, errordefo);
                setTimeout(function () {
                    defaults.msg = e;
                    defaults.method = 'GET';
                    defaults.t = new Date().getTime();
                    defaults.data = {
                        resourceUrl: location.href,
                    };
                    conf.errorList.push(defaults);
                    if (conf.page === location.href && !conf.haveAjax) reportData(3);
                }, 0);
                return oldError.apply(console, arguments);
            };
        }

        // fetch get time
        function getFetchTime(type) {
            conf.fetchNum += 1
            if (conf.fetLength === conf.fetchNum) {
                if (type == 'success') {
                    console.log('走了 fetch success 方法')
                } else {
                    console.log('走了 fetch error 方法')
                }
                conf.fetchNum = conf.fetLength = 0
                fetchTime = new Date().getTime() - beginTime
                getLargeTime();
            }
        }

        function clearPerformance(type) {
            if (window.performance && window.performance.clearResourceTimings) {
                if (conf.haveFetch && conf.fetLength == 0) {
                    clear(1)
                }
            }
        }

        function clear(type = 0) {
            if (window.performance && window.performance.clearResourceTimings) performance.clearResourceTimings();
            conf.performance = {}
            conf.errorList = []
            conf.preUrl = ''
            conf.resourceList = []
            conf.haveFetch = false;
            conf.ajaxMsg = {};
            ERRORLIST = []
            ADDDATA = {}
            fetchTime = 0
            if (type === 0) conf.page = location.href;
        }
    } catch (err) { }
}