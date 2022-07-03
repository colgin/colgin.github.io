---
title: 你真的了解JavaScript中的异步吗
date: 2017-11-22 17:06:25
description: 异步是JavaScript中的一个重要概念，本文将对js中的异步编程做一个简单的介绍。

---

## 异步初探

### setTimeout和setInterval

如果把setInterval的事时间设置为0，cpu就会频繁运行吗？答案是否定的，实验证明，浏览器上大约200次/秒，Node环境下，大约为1000次/秒。然而，如果是while循环的话，浏览器上大约触发频率是400万次/秒，Node环境下会达到400万次/秒。这是因为HTML规范推行的时延/间隔最小值是4毫秒。另外需要注意的是setTimeout和setInterval异步执行也会导致其定时精度不高。
<!--more-->
```javascript   
var start = new Date
setTimeout(function(){
    var end = new Date
    console.log(end - start)
},500)
while(new Date - start < 1000){}
```
上诉代码原本想要500毫秒之后执行函数的，然而由于setTimout和setInterval的异步特性，需要等到JavaScript代码执行完之后才能执行，所以这里会在while循环出卡住1000毫秒

由于setTimeout和setInterval的不精确性，更高精度的计时方案是
- process.nextTick()
- requestAnimationFrame():60帧/秒

> 和异步一起谈到的是非阻塞。非阻塞强调了Node的高速度。举个例子，异步MySql数据库驱动程序做一个查询可能要一个小时，但是负责发送查询请求的那个函数却能以微秒级速度返回。这对于那些需要快速处理海量需求的场景来说就很棒。

## 事件
### PubSub模式
```javascript
PubSub = {handlers:{}}
PubSub.on = function(eventType, handler) {
    if(!(eventType in this.handlers)) {
        this.handlers[eventType] = 1
    }
    this.handlers[eventType].push(handler)
}

PubSub.emit = function(eventType) {
    var handlerArgs = Array.prototype.slice.call(argument,1)
    for(var i = 0; i < this.handlers[eventType].length; i++) {
        this.handlers[eventType][i].apply(this,handlerArgs)
    }
}
```

## Promise/Deferred对象
- jQuery中的Promise/Deferred:Promise接收三种回调形式：done、fail、和progress。执行Promise对象时，运行的是done回调；拒绝Promise对象时，运行的是fail回调；对处于挂起状态的Deferred对象调用notify时，运行的是progress回调。
```javascript
var nanowrimoing = $.Deferred();
var wordGoal = 5000;
nanowrimoing.progress(function(wordCount) {
    var percentComplete = Math.floor(wordCount / wordGoal * 100)
    $('#indicator').text(percentComplete + '% complete')
})
nanowrimoing.done(function() {
    $('#indicator').text('Good job!')
})
//对数字变化进行响应
$('document').on('keypress',function() {
    var wordCount = $(this).val().split(/s+/).length
    if(wordCount >= wordGoal) {
        nanowrimoing.resolve()
    }
    nanowrimoing.notify(wordCount)
})
```
> 准确的说，Deferred是Promise的超集，他比Promise多了一项关键特性：它可以直接使用resolve（执行）和reject（拒绝）来直接触发Deferred对象。纯Promise实例只允许添加多个调用，而且必须由其他什么东西来触发这些调用。

可以通过Deferred对象的promise()方法来生成一个Promise对象，需要注意的是生成的Promise对象只是原Deferred对象一个没有方法的副本。回调绑定在Deferred或者其下辖的Promise对象并无区别。
每个Deferred对象都含有一个Promise对象，而每个Promise对象都代表一个Deferred对象。有了Deferred对象，就可以控制其状态，而有了纯Promise对象那个，只能读取其状态及附加回调。
```javascript
var prompDeferred = new $.Deferred()
var prompPromise = prompDeferred.promise()
```

理想情况下，所有的异步操作都应该返回Promise对象，但是大多数JavaScript API（浏览器或者Node)都是基于回调函数，而不是Promise对象。在基于回调函数的API中使用Promise对象最直接的方法就是生成一个Deferred对象并传递其触发器函数作为API的回调函数。
```javascript
var fileReading = new $.Deferred()
fs.readFile(filename,'utf8',function(err) {
    if(err) {
        fileReading.reject(err)
    } else {
        fileReading.resolve(Array.prototype.slice.call(arguments,1))
    }
})
```
## worker对象的多线程
多线程技术会有状态共享的难题，但是多线程又能充分利用多颗CPU内核。可以将worker理解为：应用程序的主线程对worker说，去，开一个单独的线程来运行这段代码。worker可以给主线程发送消息（反之亦可），其表现形式是事件队列中运行的回调。简而言之，与不同线程进行交互的方式在于JavaScript中进行I/O操作一模一样。
> 在操作系统层面：线程和进程有着巨大的区别，同一个进程内的多个线程可以分享状态，而彼此独立的进程之间则不能。

### 网页版的worker对象（HTML5）
```javascript
//主脚本
var worder = new Worker('boknows.js')
worker.addEventListener('message',function(e) {
    console.log(e.data)
})
//向worker发送数据
worker.postMessage('football')

//boknows.js
self.addEventListener('message',function(e) {
    //向主线程发送数据
    self.postMessage(e.data)
})
```

网页版的worker目标是在不损害DOM响应能力的前提下处理复杂的计算。可以用在解码视频，加密通信，解析网页式编辑器中的文本。
通常情况下，worker对象会把自己的计算结果发送给主线程，由主线程去更新页面，为什么不直接更新页面呢？这里主要是为了保护JavaScript异步抽象概念。如果worker对象可以改变页面的标记语言，那么最终下场就会和java一样--必须将DOM操控代码封装成互斥量和信号量来避免竞态条件。

### Node版的worker：cluster
Node版的worker对象有cluster.fork()把运行自己的同一个脚本再次加载成一个独立的进程（可以通过cluster.isMaster来检测自己是主进程还是worker对象）,目的在于Node服务器要留出计算资源以保障其主要任务：处理请求。网页版本worker对象会加载一个独立的脚本。
```javascript   
var cluster = require('cluster')
if(cluster.isMaster) {
    //分化出worker对象
    var coreCount = require('os').cpus().length
    for(var i = 0; i < coreCount; i++) {
        cluster.fork()
    }
    //绑定death事件
    cluster.on('death',function(worker) {
        console.log('Worker' + worker.pid + 'has died')
    })
} else {
    //立即死去
    process.exit()
}
```

## 异步脚本加载
### script标签
- 放在head里：如果在head标签里放了大脚本会滞压所有页面的渲染工作，使得用户在脚本加载完毕之前一直处于‘白屏死机‘状态。、
- 放在body标签末尾：如果放的是大脚本，会让用户看到毫无生命力的静态页面，原本应该进行客户端渲染的地方却散步者不起作用的空间和空空如也的方框。另外就算不是大教本，这种方式使得浏览器在加载完整个文档之前无法加载这些脚本，这对于那些通过慢速连接传送的大型文档来说是一个瓶颈。

所以这里要对不同性质的脚本分而治之，那些负责让页面更好看，更好用的脚本应该立即加载，而那些可以待会再加载的脚本可以稍后再加载（async/defer）


#### 脚本的三种加载方式

##### 同步加载（阻塞型）

脚本的获取和执行是同步的。在此过程中个页面被阻塞，停止解析。但这样如果js中有输出document内容、修改dom、重定向等行为，就会造成页面堵塞。所以一般建议把`<script>`标签放在`<body>`结尾处，这样尽可能减少页面阻塞。

##### 延迟加载（defer）

脚本的获取是异步的，执行时同步的。脚本加载不阻塞页面解析，脚本在获取完之后并不立即执行，而是等到DOMready之后才开始执行。延迟加载就是为了解决这个问题，将JS切分成许多模块，页面初始化时只加载需要立即执行的JS，然后其它JS的加载延迟到第一次需要用到的时候再加载，类似图片的延迟加载。

##### 异步脚本（async）

脚本的获取是异步的，执行是同步的。和defer的不同点在于脚本获取之后会立即执行，这就会造成脚本的执行顺序和页面上脚本的排放顺序不一样，可能会造成脚本依赖问题

![script.jpg](https://i.loli.net/2017/11/23/5a16d71516884.jpg)
