---
title: 构建web应用
date: 2017-12-02 14:36:34
description: 使用Node.js 来构建应用是一件非常简单的事，本文在前文的基础上介绍如何在Node环境下构建一个web应用
---

# 构建 web 应用

前面几章介绍了一些 Node 的基本知识，这里开始介绍如何用 Node 去构建一个 web 应用。包括请求的解析，数据上传，路由解析，中间件的知识，这些知识是 Node 中 HTTP 模块提供的最基础的功能，同时也是如今众多框架的基础。

<!--more-->

```javascript
var http = require('http')
http
  .createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Hello world')
  })
  .listen(8080)
```

真实的业务场景还需要大量的工作，但是所有的一切都基于 request 事件处理函数展开,把最终结果返回一个上面的函数作为参数即可。在具体业务开始前，需要为业务预处理一些细节，这些细节将会挂载上 req 或者 res 对象上，供业务代码使用

## 基础功能

### 请求方法

```javascript
function(req,res) {
    switch(req.method) {
    case "POST":
        update(req,res)
        break'
    case "DELETE":
        remove(req,res)
        break'
    case "PUT":
        create(req,res)
        break'
    case "GET":
    default:
        get(req,res)
        break'
    }
}

```

### 路径解析

HTTP_Parser 会将请求路径解析为 req.url。

> 需要注意的是客户端代理（浏览器）会将地址解析成报文将路径和查询部分放在报文的第一行。hash 部分会被丢弃，不会存在于报文的任何地方。

```javascript
//静态文件服务器
var url = require('url')
function(req,res) {
    var pathname = url.parse(req.url).pathname
    fs.readFile(path.join(ROOT,pathname),function(err,file) {
        if(err) {
            res.writeHead(400)
            res.end('找不到相关文件')
            return
        } else {
            res.writeHead(200)
            res.end(file)
        }
    })
}
```

### 查询字符串

```javascript
var url = require('url')
var querystring = require('querystring')
function(req,res) {
    var query = querystring.parse(url.parse(req.url).query)
    /*
    也可以通过url.parse()的第二个参数parseQueryString <boolean> 如果为 true，则 query 属性总会通过 querystring 模块的 parse() 方法生成一个对象。 如果为 false，则返回的 URL 对象上的 query 属性会是一个未解析、未解码的字符串。 默认为 false。
    var query = url.parse(req.url,true)
    */
    handle(query)
}
```

### Cookie

HTTP 是一个无状态的歇协议，而真实的业务场景确是需要一定的状态的，否则无法区分用户之间的身份。
Cookie 的处理分为以下几步

1. 服务器向客户端发送 Cookie
2. 浏览器将 Cookie 保存
3. 之后每次浏览器都会讲 Cookie 发现服务器

cookie 被 HTTP_Parser 解析到 req.header 上，可以通过 req.headers.cookie 访问(key=value;key=value),一般来说在业务逻辑代码执行前，要将转化好的 Cookie 对象挂载到 req 对象上，让之后的业务代码可以直接访问

```javascript
function(req,res) {
    req.cookies = parseCookie(req.header.cookie)
    handle(req,res)
}
```

服务器通过 Set-Cookie 字段来写 Cookie。写一个完整的 cookie 字段格式如下
_Set-Cookie:name=value;Path=/;Expires=Sun,23-Apr-23 22.02.33 GMT;Domain=.domain.com_
其中 name=value 是必须的，其他诸多选项用来控制之后浏览器向服务器发送 cookie 的行为的

```javascipt
var serialize = function(name,value,option) {
    var pairs = [name + '=' + encode(val)];
    opt = opt || {}
    if(opt.maxAge) pairs.push('Max-Age=' + option.maxage)
    if(opt.domain) pairs.push('Domain=' + option.domain)
    if(opt.path) pairs.push('Path=' + option.path)
    if(opt.expires) pairs.push('Expires=' + option.opt.expires.toUTCString())
    if(opt.httpOnly) pairs.push('HttpOnly')
    if(opt.secure) pairs.push('Secure')
    return pairs.join(';')
}
var handle = function(req,res) {
    if(!req.cookies.isVisit) {
        res.setHeader('Set-Cookie',serialize('isVisit','1'))
        res.writeHead(200)
        res.end('欢迎你第一次来')
    } else {
        res.writeHead(200)
        res.end('欢迎你再次到来')
    }
}
```

前端脚本也可以修改 Cookie，Cookie 在没有过期的时候，之后会随着 http 请求发送给服务器，如果 Cookie 太多，会造成浪费。另外如果将 Cookie 的域设置在根节点，几乎所有的子节点都会带上这些 Cookie。而一些静态文件用不着，所以可以为静态文件设置一个不同的域名。或者给 cookie 设置适当的域。

> 为静态文件设置不同的域名还有一个好处就是可以突破浏览器下载线程数量的限制，因为域名不同，可以将下载线程数翻倍。但是多一个域名，也会多一次 DNS 查询

### Session

Cookie 的问题在于容易变得体积过大，而且前后端都可以修改，数据很容易被篡改，其对敏感数据的保护是无效的。
Session 就是为了解决上述问题而生的，Session 数据只保留在服务器端，客户端无法修改，数据安全，而且也无须在协议中每次传递。但是如何将每个客户和服务器中的数据对应起来呢？
session 生成后，只要用户继续访问，服务器就会更新 session 的最后访问时间，并维护该 session，用户没访问服务器一次，无论是否该读写 session，服务器都认为用户的 session 活跃了一次。

#### 基于 Cookie 来实现用户和数据的映射

依赖于 Cookie,口令放在 cookie 中。session 有效期通常很短，普遍设置为 20 分钟，如果 20 分钟内客户端和浏览器没有交互，服务器就把数据删除
口令由服务器自动生成。同一机器的两个浏览器窗口 访问服务器时，会生成两个不同的 session。但是由浏览器窗口内的链接，脚本打开的新窗口，这类子窗口会共享父窗口的 cookie，因此会共享一个 session。以下代码中的 key 值是一个约定的 session 口令，可以随意约定，connect 默认采用 connect_id，有的则使用 session_id。

```javascript
//生成session
var session = {}
//key就是Cookie中session的口令，可以约定
var key = 'session_id'
var EXPIRES = 20*60*1000
var generate = function() {
    var session = {}
    session.id = (new Date().getTime() + Math.random())
    session.cookie = {
        expire:(new Date().getTime()) + EXPIRES
    }
    sessions[session.id] = session
    return session
}
//请求到来时，检查cooke中的口令和服务器端的数据
function(req,res) {
    var id = req.cookie[key]
    if(!id) {
        req.session = generate()
    } else {
        var session = sessions[id]
        if(session) {
            if(session.cookie.expire > (new Date()).getTime()) {
                //更新超时时间
                session.cookie.expire = (new Date()).getTime() + EXPIRES;
                req.session = session
            } else {
                //超时了，删除旧的数据，并重新生成
                delete session[id]
                req.session = generate()
            }
        } else {
            //如果session过期或口令不对，重新生成session
            req.session = generate()
        }
    }
    handle(req,res)
}
//响应给客户端时设置新的值，hack响应对象的writeHead()方法，在其内部注入Cookie逻辑
var writeHead = res.writeHead
res.writeHead = function() {
    var cookies = res.getHeader('Set-Cookie')
    var session = serialize('Set-Cookie',req.session.id)
    cookies = Array.isArray(cookies) ? cookies.concat(session) : [cookies,session]
    res.setHeader('Set-Cookie',cookies)
    return writeHead.apply(this,arguments)
}

var handle = function(req,res) {
    if(!req.session.isVisit) {
        res.session.isVisit = true
        res.writeHead(200)
        res.end('欢迎你第一次来')
    } else {
        res.writeHead(200)
        res.end('再次欢迎你')
    }
}
```

#### 通过查询字符串实现浏览器和服务器端数据的对应

检查请求的查询字符串，如果没有值，会先生成新的带值得 url

```javascript
var getURL = function(_url,key,value) {
    var obj = url.parse(_url,true)
    obj.query[key] = value
    return url.format(obj)
}
//形成跳转，让客户端重新发起请求
function(req,res) {
    var redirct = function(url) {
        res.setHeader('Location',url)
        res.writeHead(302)
        res.end()
    }
    var id = req.query[key]
    if(!id) {
        var session = generate()
        redirect(getURL(req.url,key,session.id))
    } else {
        var session = sessions[id]
        if(session) {
            if(session.cookie.expire > (new Date()).getTime()) {
                //更新超时时间
                session.cookie.expire = (new Date()).getTime() + EXPIRES;
                req.session = session
                handle(req,res)
            } else {
                //超时了，删除旧的数据，并重新生成
                delete session[id]
                var session =  req.session = generate()
                redirect(getURL(req.url,key,session.id))
            }
        } else {
            //如果session过期或口令不对，重新生成session
            var session = req.session = generate()
            redirect(getURL(req.url,key,session.id))
        }
    }
}

```

上诉这种方案没有第一种方案好，因为这种使用查询字符串的方式，如果你复制了 url 给别人，别人就拥有和你一样的身份了。

### 缓存

- 添加 Expires 和 Cache-Control 到报文头
- 配置 Etags
- 让 Ajax 缓存
  通常来说，POST、DELETE、PUT 这类行为性的请求操作不做缓存，大多数缓存只应用在 GET 请求中。![缓存][1]

关于是否可用查询。浏览器如果不能确认这份本地文件可以直接使用，会想服务器发送一次条件请求。有两种方式，时间戳和 ETag

- 时间戳：浏览器会在普通的 get 请求报文中，附带 If-Modified-Since 字段。_If-Modified-Since:Sun,03 Feb 2013 06:01:22 GMT_。服务器如果没有新的版本就会响应 304，如果有新版本就发送新版本。并将 Last-Modified 字段更新。问题在于这种方式只能精确到秒，而且文件时间戳改变了，内容却不定改动。（使用 touch 命令）
- ETag：服务端生成，服务端可以决定他的生成规则。一般是内容的散列值。请求响应头是 If-None-Match/ETag 字段。_If-None-Match:"82-1524485454000"_,_ETag:"82-1524485454000"_

上诉两种方式都需要重新请求服务器，可以使用 Expires 或者 Cache-Control 字段让浏览器进行缓存，一定条件下可以不用再向服务器请求。Expires 会有浏览器和服务器不同步的问题，如服务器提前过期。而 Cache-Control 可以有效避免这个问题。

使用 Expires 和 Cache-Control 字段又叫强缓存，意思就是如果命中缓存将不需要再和服务器进行交互，而使用 Etags 或者 If-Modifie-Since 则是弱缓存，需要和浏览器再进行一次交互（条件请求）的叫做协商缓存。强缓存的优先级要高于协商缓存。在强缓存没有命中的情况下才会进行协商缓存（缓存的时间到期了，并不意味着资源资源内容发生改变）

### 清除缓存

当服务器意外更新了资源，又无法通知客户端更新。由于浏览器是根据 URL 进行缓存，一般解决方案是每次发布，路径中跟随 web 应用的版本号或者文件内容的 hash 值。

### Basic 认证

Basic 认证是 HTTP 中非常简单的认证方式，因为简单（近乎于明文，一般只有 https 才会使用），所以不是很安全，不过仍然非常常用。
当一个客户端向一个需要认证的 HTTP 服务器进行数据请求时，如果之前没有认证过，HTTP 服务器会返回 401 状态码，要求客户端输入用户名和密码。用户输入用户名和密码后，用户名和密码会经过 BASE64 加密附加到请求信息中再次请求 HTTP 服务器，HTTP 服务器会根据请求头携带的认证信息，决定是否认证成功及做出相应的响应。_Authorization:Basic dXNlcjpwYXNz_

```javascript
function encode(username,password) {
    return new Buffer(username + ":" + password).toString('base64)
}
funtion(req,res) {
    var auth = req.headers['authorization'] || ''
    var parts = auth.split(' ')
    var method = part[0] || ''//Basic
    var encoded = part[1] || ''
    var decoded = new Buffer(encoded,'base64').toString('utf8').split(':')
    var user = decoded[0]
    var pass = decoded[1]
    if(!checkUser(user,pass)) {
        res.setHeader('WWW-Authenticate','Basic realm="Secure Area"')
        res.writeHead(401)
        res.end()
    } else {
        handle(req,res)
    }
}
```

## 数据上传

如果请求中还带有 Transfer-Encoding 或 Content-Length 即可判断请求中带有内容

> HTTP_Parser 解析完请求头之后触发'request'事件，如果有请求体的话，报文内容会通过 data 事件从触发，我们需要以流的方式处理

```javascript
var hasBody = function(req) {
    return('transfer-encoding' in req.headers || 'content-length' in req.headers)
}
function(req,res) {
    if(hasBody(req)) {
        var buffers = []
        req.on('data',function(chunk) {
            buffers.push(chunk)
        })
        req.on('end',function() {
            req.rawBody = Buffer.concat(buffers).toString()
            handle(req,res)
        })
    } else {
        handle(req,res)
    }
}
```

### 表单数据

请求头 Content-Type:application/x-www-form-urlencoded。报文体内容 foo=bar&&baz=val

```javascript
var handle = function (req, res) {
  if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
    req.body = querystring.parse(req.rawBody)
  }
  todo(req, res)
}
```

### JSON 数据

请求头 Content-Type:application/json。例如:_Content-Type:application/json;charset=utf-8_

```javascript
var mime = function (req) {
  var str = req.headers['content-type'] || ''
  return str.split(';')[0]
}
var handle = function (req, res) {
  if (mime(req) === 'application/json') {
    try {
      req.body = JSON.parse(req.rawBody)
    } catch (e) {
      res.writeHead(400)
      res.end('Invalid JSON')
      return
    }
  }
  todo(req, res)
}
```

### XML 数据

请求头 Content-Type:application/xml。需要借助库来实现 XML 数据的解析

### 文件上传

请求头 Content-Type:multipart/form-data。例如*Content-Type:multipart/form-data;boundary=AaB03x
Content-Length:58812*。其中 boundary 是随机生成的一段字符串，指定每部分内容的分界符。报文体的内容通过"··"分割,Content-Length 表示报文体长度。以流的方式处理。

### 数据上传的安全问题

在解析表单数据，JSON，XML 都是先接收保存数据，然后在解析的。这种方案在数据量大，高并发的情况下容易发生内存耗完的情况。一般有两个解决方案

- 限制上传文件内容大小，超过限制，停止接收，返回 400
- 通过流式解析，将数据流导向到磁盘中，Node 只保留文件路径等小数据

```javascript
var bytes = 1024
function(req,res) {
    var received = 0
    var len = req.headers['content-length'] ? parseInt(req.headers['content-length'],10) : null
    //内容超过长度限制，返回413
    if(len && len > bytes) {
        res.writeHead(413)
        res.end()
        return
    }
    //limit,针对没有Content-Length字段的请求
    req.on('data',function(req,res) {
        received += chunk.length
        if(received > bytes) {
            req.destroy()
        }
    })
    handle(req,res)
}
```

## 路由解析

### 文件路径型

url 路径和网站目录一直，无须转换，非常直观。通过 url 直接请求静态源文件，通过 url 找到对应脚本，web 服务器根据文件后缀去好脚本解析器，并传入 http 上下文，执行脚本，发出响应。

### MVC

用户请求的 URL 和具体脚本所在路径没有任何关系
![MVC][2]

- 控制器（Controller）,一组行为的集合
- 模型（Model），数据相关的操作和封装
- 视图（View），视图渲染
  工作模式如下

1. 路径解析，根据 URL 寻找到对应控制器
2. 行为调用相关模型
3. 数据操作结束后，调用视图和相关数据进行页面渲染，输出到客户端

URL 如何映射到 MVC 有几种方法：手工映射（正则匹配，参数解析），自然映射

#### 手工映射

需要一个路由文件来讲 URL 映射到对应控制器

```javascript
//一个处理设置用户信息的控制器
exports.setting = function(req,res) {
    //to do something
}
//一个将url映射到控制器的函数
var routes = []
var use = function(path,action) {
    routes.push([path,action])
}
function(req,res) {
    var pathname = url.parse(req.url).pathname
    for(var i = 0; i < routes.length; i++) {
        var route = routes[i]
        if(pathname === route[0]) {
            var action = route[1]
            acrion(req,res)
            return
        }
    }
    handle404(req,res)
}

use('/user/setting',exports.setting)
```

而正则匹配就是以正则表达式的形式去匹配路由。参数解析主要是针对 url 中带有参数的情况，如*/profile/:usename*,将 url 中的字段解析成 username 放到 req.params 中。

#### 自然映射

路由按照一种约定的方式自然而然地实现了路由，而无须去维护路由。路径形式例如*/controller/action/param1/param2/param3*

```javascript
function(req,res) {
    var pathname = url.parse(req,url).pathname
    var paths = pathname.split('/')
    var controller = paths[1] || 'index'
    var action = path[2] || 'index'
    var args = paths.slice(3)
    var module
    try {
        module = require('./controller/' + controller)
    } catch (e) {
        handle500(req,res)
        return
    }
    var method = module[action]
    if(method) {
        method.apply(null,[req,res].concat(args))
    } else {
        handle500(req,res)
    }
}
```

### RESTful

REST:Representational State Transfer,表现层状态转移。符合 REST 设计叫做 RESTful。设计哲学在于将服务器提供的内容实体看做一个资源，并变现在 URL 上，对这个资源的操作体现在 HTTP 请求上（POST,DELETE,PUT,GET 增删改查，之前是 GET，POST 方法传入在 URL 上传递 action）。对于资源的具体变现形态也不同于过去一样表现在 URL 的后缀上，而是有请求报头的 Accept 字段和服务器支持情况来决定。如*Accept:application/json,application/xml*。服务器可以根据这个字段做出响应，并且在响应报文中的 Content-Type 字段中告知。总之就是通过 URL 设计资源、请求方法定义资源操作，通过 Accept 决定资源的表现形式。

## 中间件

使用中间件来隔离基础设施与业务逻辑中间的细节，让开发者能够关注在业务的开发上。由于 Node 异步运行机制的问题，需要一种机制来实现，在当前中间件处理完成后，通知下一个中间件执行。（例如尾触发）

![中间件][3]


```javascript
//querystring解析中间件
var querystring = function (req, res, next) {
  req.query = url.parse(req.url, true)
  next()
}
//cookie解析中间件
var cookie = function (req, res, next) {
  var cookie = req.heders.cookie
  var cookies = {}
  if (cookie) {
    var list = cookie.split(';')
    for (var i = 0; i < list.length; i++) {
      var pair = list[i].split('=')
      cookies[pair[0].trim()] = pair[1]
    }
  }
  req.cookies = cookies
  next()
}
```

可以使用 app.use()来将中间件都存进 stack 数组中保存，等待匹配后触发执行。

```javascript
var routes = {'all':[]}
var app = {}
app.use = function(path) {
    var handle
    if(typeof path === 'string'){
        handle = {
            //第一个参数作为路径
            path:pathRegexp(path)
            //将中间件存进stack数组
            stack:Array.prototype.slice.call(arguments,1)
        }
    } else {
        handle = {
            path:pathRegexp('/')
            stack:Array.prototype.slice.call(arguments,1)
        }
    }
    routes.all.push(handle)
}
//匹配函数
var match = function(pathname,routes) {
    var stacks = []
    for(var i = 0; i < routes.length; i++) {
        var route = routes[i]
        var reg = route.path.regexp
        var matched = reg.exec(pathname)
        if(matched) {
            stacks = stacks.concat(route.stack)
        }
    }
    return stacks
}
function(req,res) {
    var pathname = url.parse(req.url).pathname
    var method = req.method.toLowerCase()
    //获取all()方法里的中间件
    var stacks = match(pathname,routes.all)
    if(routes.hasOwnPropery(method)) {
        //根据请求方法，获取相关中间件
        stacks.concat(match(pathname,routes[method]))
    }
    if(stacks.length) {
        handle(req,res,stacks)
    } else {
        handle404(req,res)
    }
}
```

### 异常处理

```javascript
var handle = function (req, res, stack) {
  var next = function (err) {
    if (err) {
      return handle500(err, req, res, stack)
    }
    //从stack数组中取出中间件并执行
    var middleware = stack.shift()
    if (middleware) {
      try {
        middleware(req, res, next)
      } catch (e) {
        next(e)
      }
    }
  }
}
```

## 页面渲染

### 内容响应

响应报头*Content-Encoding*、_Content-Length_、_Content-Type_。浏览器会根据响应头的 Content-Type 采用不同的而处理方式。Content-Type 的值也叫 MIME（Multipurpose Internet Mail Extensions）值。不同的文件类型有不同的 MIME 值。
附件下载：无论响应内容什么样的 MIME 值，都不需要客户端打开它，只需要弹出并下载它即可。可以使用*Content-Disposition*字段。这个字段影响的行为是客户端会根据这个值判断是应该将报文数据当做即时浏览的内容（inline），还是可以下载的附件（attachment）。
_Content-Disposition:attachment;filename="filename.txt"_

```javascript
res.sendfile = function (filepath) {
  fs.stat(filepath, function (err, stat) {
    var stream = fs.createReadStream(filepath)
    res.setHeader('Content-Type', mime.lookup(filepath))
    res.setHeader('Content-Length', stat.size)
    res.setHeader(
      'Content-Disposition',
      'attachment' + filename + path.basename()
    )
  })
}
```

### 模板

模板实现的其实就是字符串的拼接
