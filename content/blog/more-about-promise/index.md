---
title: Promise一些细节
date: 2017-12-03 13:42:08
description: 最常用的API，往往藏着你不知道的秘密

---

# Promise一些细节

Promise是抽象异步处理对象以及对其进行各种操作的组件。
在Promise之前我们一直使用回调的形式来处理异步。
```javascript
getAsync('file.txt',function(error,result) {
    if(error) {
        throw error
    } else {
        //处理结果
    }
})
```
<!--more-->
这种方式的问题在于回调函数的参数基于约定，而且容易出现回调地狱问题。
## Promise对象创建
```javascript
var promise = new Promise(function(resolve,reject) {
    //异步处理
    //处理结束后，调用resolve或reject
})
```
promise对象有三种状态
- unresolved-Pending：就是promise对象刚刚创建后的初始化状态
- has-resolution-Fulfilled：resolve（成功）时，此时会调用onFulfilled
- has-rejection-Rejected：reject（失败）时，此时会调用onRejected
  状态
  从Pending转换为Fulfilled或Rejected后，这个promise对象的状态就不会发生任何变化。
```javascript
//一个实例了解promise 
function getURL(URL) {
    return new Promise(function (resolve, reject) {
        var req = new XMLHttpRequest();
        req.open('GET', URL, true);
        req.onload = function () {
            if (req.status === 200) {
                resolve(req.responseText);
            } else {
                reject(new Error(req.statusText));
            }
        };
        req.onerror = function () {
            reject(new Error(req.statusText));
        };
        req.send();
    });
}
// 运行示例
var URL = "http://httpbin.org/get";
getURL(URL).then(function onFulfilled(value){
    console.log(value);
}).catch(function onRejected(error){
    console.error(error);
});
```
## Promise静态方法
### Promise.resolve()
静态方法Promise.resolve(value)可以认为是new Promise()方法的快捷方式。
```javascript
//下面两种方式效果一样
Promise.resolve(48)

new Promise(function(resolve) {
    resolve(48)
})
```
上诉两段代码会让返回一个promise对象，并且让这个promise对象立即进入resolved状态，并且将48传递给后面then里所指定的onFulfilled函数。仍然是异步调用。
除此之外，Promise.resolve方法另一个方法就是讲thenable对象转换为promise对象。
> thenable对象是ES6 Promises提出的一个概念，指的是一个具有.then方法的对象。使用Promise.resolve方法可以将thenable对象转换为promise对象，并且之后可以调用thenable对象本身的then方法
```javascript
var promise = Promise.resolve($.ajax('comment.json'))
promise.then(function(value) {
    console.log(value)
})
```

上诉jQuery.ajax方法返回值是一个jqXHR Object对象(继承自Deferred Object)，但是Deferred Object并没有遵循Promises/A+或ES6 Promises标准。将Deferred Object对象转换成一个promise对象时，会出现缺失部分信息的问题。

### Promise.reject
Promise.reject(error)同样是new Promise()的快捷方式
```javascript
//下面两种实现是一样的
Promise.reject(new Error('出错了'))

new Promise(function(resolve,reject) {
    reject(new Error('出错了'))
})
```
### Promise.all
接收一个promise对象数组作为参数，当这个数组里的所有promise对象全部变为resolve或reject状态时，才会调用.then方法。数组中的每个promise会同时执行，传递给then方法的参数也是和promise数组顺序
### Promise.race
接收一个promise对象数组为参数，只要有一个对象promise变为fulfilled或者rejected状态，就会继续进行后续的处理。
## Promise实例方法
### promise的链式应用
```javascript
function taskA() {
    console.log("Task A");
    throw new Error("throw Error @ Task A")
}
function taskB() {
    console.log("Task B");// 不会被调用
}
function onRejected(error) {
    console.log(error);// => "throw Error @ Task A"
}
function finalTask() {
    console.log("Final Task");
}

var promise = Promise.resolve();
promise
    .then(taskA)
    .then(taskB)
    .catch(onRejected)
    .then(finalTask);

//这里会依次输出Task A => throw Error @ Task A => Final Task
```
需要注意的是taskA中出错了，会跳过taskB，直接到catch,catch处理之后返回的仍然是一个promise对象，被认为了处理好了异常，然后调用下一个then。
### promise#then 和 promise#catch
实际上，promise.catch只是promise.then(undefined,onRejected)方法的一个别名。但在实际使用上还是有些区别的。
```javascript
function throwError(value) {
    // 抛出异常
    throw new Error(value);
}
// <1> onRejected不会被调用
function badMain(onRejected) {
    return Promise.resolve(42).then(throwError, onRejected);
}
// <2> 有异常发生时onRejected会被调用
function goodMain(onRejected) {
    return Promise.resolve(42).then(throwError).catch(onRejected);
}
// 运行示例
badMain(function(){
    console.log("BAD");
});
goodMain(function(){
    console.log("GOOD");
});
```
上诉两种处理异常的手段区别显而易见，使用then指定第二个参数来做异常处理，不能捕获then第一个参数(onFulfilled)执行过程中抛出的错误。而使用catch则可以捕获到。原因在于.then方法中onRejected参数所指定的回调函数，实际上针对的是其promise对象或者之前的promise对象而不是.then方法里面指定的第一个参数，即onFulfilled所指向的对象。
每次调用then,catch都会返回一个新创建的promise对象。而不是针对针对最初的promise对象进行一连串的链式调用。

## Promise测试（Mocha）
### 回调风格，使用done的Promise测试
```javascript
it("should use `done` for test?", function (done) {
    var promise = Promise.resolve(42);
    promise.then(function (value) {
        assert(value === 42);
        done();
    });
});
```
上诉代码会先创建Fulfilled的promise对象，然后调用done后测试结束
```javascript
it("should use `done` for test?", function (done) {
    var promise = Promise.resolve();
    promise.then(function (value) {
        assert(false);
    }).then(done, done);
});
```
上诉代码断言错误，如果不写下一个then的话，直接调用done()，这样测试会出问题的，原因在于then方法里面出错，状态会被promise捕获，测试框架对此一无所知。所以要在后面调用then来捕获。
### Mocha对Promise的支持
```javascript
var assert = require('power-assert');
describe('Promise Test', function () {
    it('should return a promise object', function () {
        var promise = Promise.resolve(1);
        return promise.then(function (value) {
            assert(value === 1);
        });
    });
});
```
## 一些Tips
### 使用reject而不是throw
```javascript
var promise = new Promise(function(resolve, reject){
    throw new Error("message");
});
promise.catch(function(error){
    console.error(error);// => "message"
});

var promise = new Promise(function(resolve, reject){
    reject(new Error("message"));
});
promise.catch(function(error){
    console.error(error);// => "message"
})
```
上诉两种方法都是抛出异常。但是使用reject会更合理一些。因为我们很难区分throw是我们主动抛出来的，还是因为真正的异常导致的。
### 在then中reject
```javascript
var onRejected = console.error.bind(console);
var promise = Promise.resolve();
promise.then(function () {
    var retPromise = new Promise(function (resolve, reject) {
       reject(new Error("this promise is rejected"));
    });
    return retPromise;
}).catch(onRejected);
```
在then函数中注册的回调函数可以通过return返回一个值（任何JavaScript的合法值，包括undefined，thenable和promise），这个返回值会传给then或catch中的回调函数。如上所诉，同样也可以使用Promise。在then中reject。

```javascript
var onRejected = console.error.bind(console);
var promise = Promise.resolve();
promise.then(function () {
    return Promise.reject(new Error("this promise is rejected"));
}).catch(onRejected);
```
## 消失的错误
promise虽然具有强大的错误处理机制，但是（调试工具不能顺利运行的时候）这个功能会导致人为错误更加复杂，这也是它的一个缺点。
```javascript
//下面这种异常很容易难排除
function JSONPromise(value) {
    return new Promise(function (resolve) {
        //如果这里遇到非法的value，JSON.parse解析失败会抛出异常
        resolve(JSON.parse(value));
    });
}
//比如这种syntax error（console拼写错误）
var string = "{}";
JSONPromise(string).then(function (object) {
    conosle.log(object);
});
```
由于Promise的try-catch机制，这个问题很可能会被内部消化掉。如果在调用的时候每次都无遗漏的进行catch处理的话当然最好了，但是如果在实现的过程中出现了这个例子中的错误，那么进行错误排除工作也变得困难。这种错误被内部消化的问题也被叫做unhandled rejection，就是在Rejected时没有找到相应处理的意思。
针对上诉问题，一些库会有promise.done这个方法。用在链式调用的最末端，它不会反悔promise。
```javascript
if (typeof Promise.prototype.done === "undefined") {
    Promise.prototype.done = function (onFulfilled, onRejected) {
        this.then(onFulfilled, onRejected).catch(function (error) {
            setTimeout(function () {
                throw error;
            }, 0);
        });
    };
}
```
它会将异常抛到Promise的外面，使用setTimeout中的throw方法。



## Promise一些易错点
### 在then里面我们可以做以下三件事
1. return 另一个promise
2. return 一个同步值（或者undefined）
3. throw 一个同步异常

```javascript
promise2 = promise1.then(onFulfilled,onRejected)
```

根据[Promise/A+规范](http://www.ituring.com.cn/article/66566)。
一个priomise对象的then方法必须返回返回一个Promise对象
- 如果onFulfilled或onRejected返回一个值，则用Promise.resolve将其包装成promise。
- 如果onFulfilled或onRejected抛出异常e，则promise2必须拒绝执行，并返回e
- 如果onFulfilled不是函数且promise1成功执行，promise2必须成功执行并返回相同的值
- 如果onRejected不是函数且promise1拒绝执行，promise必须拒绝执行并返回相同的拒因。

需要注意的是上面的返回：不论promise1被reject还是被resolve时promise2都会被resolve，只有出现异常时才会被rejected

```javascript
//返回一个promise，这里一定要注意使用return，要不然下一个函数将收到undefin而不是userAccount
getUserByName('nolan').then(function (user) {
  return getUserAccountById(user.id);
}).then(function (userAccount) {
  // I got a user account!
});
//return 一个同步值(或者同步值)
getUserByName('nolan').then(function (user) {
  if (inMemoryCache[user.id]) {
    return inMemoryCache[user.id];    // returning a synchronous value!
  }
  return getUserAccountById(user.id); // returning a promise!
}).then(function (userAccount) {
  // I got a user account!
});
//throw一个异常
getUserByName('nolan').then(function (user) {
  if (user.isLoggedOut()) {
    throw new Error('user logged out!'); // throwing a synchronous error!
  }
  if (inMemoryCache[user.id]) {
    return inMemoryCache[user.id];       // returning a synchronous value!
  }
  return getUserAccountById(user.id);    // returning a promise!
}).then(function (userAccount) {
  // I got a user account!
}).catch(function (err) {
  // Boo, I got an error!
});
```

### promises vs promises factories
有时候我们希望执行一个个的执行一个promises序列，类似Promise.all()但是并非并行执行所有promise。
```javascript
function executeSequentially(promises) {
  var result = Promise.resolve();
  promises.forEach(function (promise) {
    result = result.then(promise);
  });
  return result;
}
```
其实上诉代码是不行的。传入executeSequentially()的promises依然会并行执行。根据promise规范，一旦一个promise被创建，它就被执行了。所以这里需要一个promise factories数组。
```javascript
function executeSequentially(promiseFactories) {
  var result = Promise.resolve();
  promiseFactories.forEach(function (promiseFactory) {
    result = result.then(promiseFactory);
  });
  return result;
}
function myPromiseFactory() {
  return somethingThatCreatesAPromise();
}
```
上诉代码可以达到目的，这是因为一个promise factory 在被执行之前并不会创建promise。我们可以理解为then函数理应接收一个函数，如果接收的是一个promise，并不会按照期望运行，因为promise被创建就被执行了。
