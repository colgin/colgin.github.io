---
title: package.json中的browser字段
date: 2019-06-30 11:13:24
description: package.json中的browser字段，听过用过吗？
---

## package.json中的browser字段

有时候，我们想要写一个能够跑在浏览器上和node上的包，但是由于二者在执行环境上有微弱的区别，比如浏览器上请求数据是用XMLHttpRequest对象，但是node上用的确是http或者https，诸如此类的差异还有很多。这就导致了我们要为浏览器端和node端准备不同的源文件，那我们要怎么区分不同的环境呢？
<!--more-->

### 依赖打包器的process.browser
在此，以实现base64编码为例，在同一个入口文件，可以根据打包器提供的process.browser字段（在浏览器环境下为true，在node环境下为false）
```js
if (process.browser) {
module.exports = function (string) {
return btoa(string)
}
} else {
module.exports = function (string) {
return Buffer.from(string, 'binary').toString('base64')
}
}
```

但是这种方式有一个很大的问题，打包器会在执行上诉代码中会为包引入polyfill，在这个例子中就是在浏览器中的Buffer实现[buffer](https://github.com/feross/buffer)。这样打包出来的体积就会很大

### 使用package.json的browser字段

[npm doc](https://docs.npmjs.com/files/package.json)上的解释如下
> If your module is meant to be used client-side the browser field should be used instead of the main field. This is helpful to hint users that it might rely on primitives that aren’t available in Node.js modules. (e.g. window)

总而言之就是在浏览器环境下用来替换main字段，包的作者可以通过browser字段提示包中要替换掉哪些模块或者要替换掉哪些源文件的实现。

browser的用法有以下几种
1. browser为某一个单个的字符串
替换main成为浏览器环境的入口文件
```json
"browser": "./lib/browser/main.js"
```
2. browser为一个对象，声明要替换或者忽略的文件
这种形式比较适合替换部分文件，不需要创建新的入口。key是要替换的module或者文件名，右侧是替换的
```json
"browser": {
"module-a": "./browser/module-a.js",
"./server/module-b.js": "./browser/module-b.js"
}
```

打包器在打包到浏览器环境时，会将来自module-a的替换为'./browser/module-a.js'。将文件'./server/module-b.js'的引入替换为'./browser/module-b.js'。

还可以使用布尔值防止将module加载到包中
```json
"browser": {
"module-a":false,
"./server/only.js":"./shims/server-only.js"
}
```
这种写法module-a在浏览器环境中将不会被打包。

上面的所有写法的路径都是基于package.json文件地址。


需要注意的是如果你的包能在浏览器和node上无差异化地实现，就不需要browser字段了。


参考资料:

[[译] 怎样写一个能同时用于 Node 和浏览器的 JavaScript 包？](https://zhuanlan.zhihu.com/p/25215447)

[package.json 中 你还不清楚的 browser，module，main 字段优先级](https://juejin.im/post/5cfe6d3be51d454d544abf30)

[package-browser-field-spec, 在 package.json 中，'browser'字段的规范文档](https://www.helplib.com/GitHub/article_134305)
