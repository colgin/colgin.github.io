---
title: koa源码解析
date: 2020-05-23 18:51:26
description: 简单强大的koa源码，非常值得一读的源码
---

Koa是Node应用广泛的后端框架，它的“洋葱”模型被人津津乐道，Koa源码实现也非常简练，那就一起来看下Koa的源码吧。

<!--more-->

## 工程化

```jsx
# .editorconfig
# editorconfig.org
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

```yaml
# .travis.yml
language: node_js
node_js:
  - 8
  - 10
  - 12
cache:
  directories:
    - wrk/bin
    - node_modules
before_script:
  - npm prune
  - "[ ! -f wrk/bin/wrk ] && rm -rf wrk && git clone https://github.com/wg/wrk.git && make -C wrk && mkdir wrk/bin && mv wrk/wrk wrk/bin || true"
  - export PATH=$PATH:$PWD/wrk/bin/
script:
  - npm run lint
  - npm run test-cov
  - npm run bench
after_script:
  # only upload the coverage.json file
  - bash <(curl -s https://codecov.io/bash) -f coverage/coverage-final.json
```

npm prune会移除无关的包，所谓无关指的是没有在父包的依赖关系列表中列出的包。参考[npm prune](https://www.npmjs.cn/cli/prune/)

[wrk](https://github.com/wg/wrk)是一个http测试工具

```bash
wrk -t12 -c400 -d30s http://127.0.0.1:8080/index.html
```

意思就是看看30s，用12个线程，开400个http连接能处理多少个http请求。

再看`package.json`

```bash
{
  "name": "koa",
  "version": "2.12.0",
  "description": "Koa web app framework",
  "main": "lib/application.js",
  "scripts": {
    "test": "egg-bin test test",
    "test-cov": "egg-bin cov test",
    "lint": "eslint benchmarks lib test",
    "bench": "make -C benchmarks",
    "authors": "git log --format='%aN <%aE>' | sort -u > AUTHORS"
  },
  "repository": "koajs/koa",
  "keywords": [
    "web",
    "app",
    "http",
    "application",
    "framework",
    "middleware",
    "rack"
  ],
  "license": "MIT",
  "dependencies": {
    "accepts": "^1.3.5",
    "cache-content-type": "^1.0.0",
    "content-disposition": "~0.5.2",
    "content-type": "^1.0.4",
    "cookies": "~0.8.0",
    "debug": "~3.1.0",
    "delegates": "^1.0.0",
    "depd": "^1.1.2",
    "destroy": "^1.0.4",
    "encodeurl": "^1.0.2",
    "escape-html": "^1.0.3",
    "fresh": "~0.5.2",
    "http-assert": "^1.3.0",
    "http-errors": "^1.6.3",
    "is-generator-function": "^1.0.7",
    "koa-compose": "^4.1.0",
    "koa-convert": "^1.2.0",
    "on-finished": "^2.3.0",
    "only": "~0.0.2",
    "parseurl": "^1.3.2",
    "statuses": "^1.5.0",
    "type-is": "^1.6.16",
    "vary": "^1.1.2"
  },
  "devDependencies": {
    "egg-bin": "^4.13.0",
    "eslint": "^6.5.1",
    "eslint-config-koa": "^2.0.0",
    "eslint-config-standard": "^14.1.0",
    "eslint-plugin-import": "^2.18.2",
    "eslint-plugin-node": "^10.0.0",
    "eslint-plugin-promise": "^4.2.1",
    "eslint-plugin-standard": "^4.0.1",
    "mm": "^2.5.0",
    "supertest": "^3.1.0"
  },
  "engines": {
    "node": "^4.8.4 || ^6.10.1 || ^7.10.1 || >= 8.1.4"
  },
  "files": [
    "lib"
  ]
}
```

这里需要留意的是有一个`authors`命令, `git log --format='%aN <%aE>' | sort -u > AUTHORS`

这条命令是把git 提交记录的姓名和邮件排序输出到AUTHORS文件。

## 核心代码

### 入口

入口是[application.js](https://github.com/koajs/koa/blob/master/lib/application.js)

先看构造函数

```jsx
module.exports = class Application extends Emitter {
  /**
   * Initialize a new `Application`.
   *
   * @api public
   */

  /**
    *
    * @param {object} [options] Application options
    * @param {string} [options.env='development'] Environment
    * @param {string[]} [options.keys] Signed cookie keys
    * @param {boolean} [options.proxy] Trust proxy headers
    * @param {number} [options.subdomainOffset] Subdomain offset
    * @param {boolean} [options.proxyIpHeader] proxy ip header, default to X-Forwarded-For
    * @param {boolean} [options.maxIpsCount] max ips read from proxy ip header, default to 0 (means infinity)
    *
    */

  constructor(options) {
    super();
    options = options || {};
    this.proxy = options.proxy || false;
    this.subdomainOffset = options.subdomainOffset || 2;
    this.proxyIpHeader = options.proxyIpHeader || 'X-Forwarded-For';
    this.maxIpsCount = options.maxIpsCount || 0;
    this.env = options.env || process.env.NODE_ENV || 'development';
    if (options.keys) this.keys = options.keys;
    this.middleware = [];
    this.context = Object.create(context);
    this.request = Object.create(request);
    this.response = Object.create(response);
    if (util.inspect.custom) {
      this[util.inspect.custom] = this.inspect;
    }
  }
}
```

就是一些初始化流程，把options的一些选项挂在到this上。这里有一个要留意的是代理相关的配置。

```jsx
listen(...args) {
	debug('debug')
	const server = http.createServer(this.callback())
	return server.listen(...args)
}
```

这里http.createServer接收的是一个`function(req, res) {}`函数，这里调用了calllback生成这样一个函数。这样的设计使得可以将callback生成的处理器放到任何能够接受监听器函数中用于启动一个服务，比如说http.createServer或者express。

```jsx
callback() {
	const fn = compose(this.middleware)

	if (!this.listenerCount('error)) this.on('error', this.onerror)

	const handleRequest = (req, res) => {
		const ctx = this.createContext(req, res)
		return this.handleRequest(ctx, fn)
	}
}
```

这里主要就是构造出一个上下文对象，然后在handleRequest里去处理这个请求。

先看下创建上下文的函数`createContext`吧

```jsx
createContext(req, res) {
    const context = Object.create(this.context);
    const request = context.request = Object.create(this.request);
    const response = context.response = Object.create(this.response);
    context.app = request.app = response.app = this;
    context.req = request.req = response.req = req;
    context.res = request.res = response.res = res;
    request.ctx = response.ctx = context;
    request.response = response;
    response.request = request;
    context.originalUrl = request.originalUrl = req.url;
    context.state = {};
    return context;
  }
```

前面构造函数中对`this.context`, `this.request`, `this.response`进行了初始化

```jsx
this.context = Object.create(context);
this.request = Object.create(request);
this.response = Object.create(response);
```

`createContext`做的就是给context变量里的req,res,ctx进行赋值，吧res和req不仅挂到了context上，还挂到了`contex.request`, `context.response`上。

接下来看一下koa为人津津乐道的插件机制。在[koa github](https://www.github.com/koajs/koa)主页上有这么一段话介绍koa

- Expressive HTTP middleware framework for node.js to make web applications and APIs more enjoyable to write. Koa's middleware stack flows in a stack-like manner, allowing you to perform actions downstream then filter and manipulate the response upstream

koa提供了一个web框架的核心部分，不包含路由处理，静态文件处理（这些都是通过中间件来实现），我们经常会把这种叫做洋葱模型。

!![2892151181-5ab48de7b5013_articlex.png](https://i.loli.net/2020/05/23/FBRVDXMQpwJny6e.png)

实际使用中使用use来给koa应用注册中间件，中间件按照注册顺序按序调用，前面的中间件可以调用next()来控制下一个中间件的执行。

```jsx
const Koa = require('koa');
const app = new Koa();

// logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.get('X-Response-Time');
  console.log(`${ctx.method} ${ctx.url} - ${rt}`);
});

// x-response-time

app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.set('X-Response-Time', `${ms}ms`);
});

// response

app.use(async ctx => {
  ctx.body = 'Hello World';
});

app.listen(3000);
```

通过中间件可以做到调用下游，控制流回上游

那这个是怎么实现的呢？先来看use的实现

```jsx
use(fn) {
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!');
    if (isGeneratorFunction(fn)) {
      deprecate('Support for generators will be removed in v3. ' +
                'See the documentation for examples of how to convert old middleware ' +
                'https://github.com/koajs/koa/blob/master/docs/migration.md');
      fn = convert(fn);
    }
    debug('use %s', fn._name || fn.name || '-');
    this.middleware.push(fn);
    return this;
  }
```

use函数实现非常简单，就是把注册进来中间件函数`(context, next) ⇒ {}`  存放到实例的middleware里面。那么这个middleware是怎么起作用的呢？

细心的你可能在之前的`callback` 函数中发现有这样一行

```jsx
const fn = compose(this.middleware)
```

这行代码就是实现中间件的精髓。compose将所有的中间件组合成一个函数。

先不看官方的实现，我们可以自己实现一个这样的compose函数

```jsx
const compose = (middlewares) => (ctx) => {
  const dispatch = (i) => {
    const fn = middlewares[i]

    // 最后一个中间件调用next不能报错
    if (!fn) {
      return Promise.resolve()
    }

    return Promise.resolve(fn(ctx, () => dispatch(i + 1)))
  }

  dispatch(0)
}
```

可以看到，compose生成了一个新的函数，在这个函数中我们把ctx传入进去，所有的中间件都会执行，执行的顺序通过给中间件函数传递的第二个参数来控制，也就是说把在第n+1个中间件函数的执行权交给第n个中间件函数。

koa实际是使用了[koa/compose](https://github.com/koajs/compose#readme)。这里一并把代码贴出来

```jsx
module.exports = compose

/**
 * Compose `middleware` returning
 * a fully valid middleware comprised
 * of all those which are passed.
 *
 * @param {Array} middleware
 * @return {Function}
 * @api public
 */

function compose (middleware) {
  if (!Array.isArray(middleware)) throw new TypeError('Middleware stack must be an array!')
  for (const fn of middleware) {
    if (typeof fn !== 'function') throw new TypeError('Middleware must be composed of functions!')
  }

  /**
   * @param {Object} context
   * @return {Promise}
   * @api public
   */

  return function (context, next) {
    // last called middleware #
    let index = -1
    return dispatch(0)
    function dispatch (i) {
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))
      index = i
      let fn = middleware[i]
      if (i === middleware.length) fn = next
      if (!fn) return Promise.resolve()
      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}
```

相对于简陋版本的compose来说，这里的compose考虑了不能在一个中间件中调用多次next，还处理了最后一个中间件不调用next的情况。

Koa构造函数还有两个函数，toJSON, inspect，这俩函数就是返回指定的几个字段。

```jsx
/**
   * Return JSON representation.
   * We only bother showing settings.
   *
   * @return {Object}
   * @api public
   */

  toJSON() {
    return only(this, [
      'subdomainOffset',
      'proxy',
      'env'
    ]);
  }

  /**
   * Inspect implementation.
   *
   * @return {Object}
   * @api public
   */

  inspect() {
    return this.toJSON();
  }
```

再看下处理请求的部分，处理请求包括错误处理，数据响应。这里有一个onFinished(res, onerror)是在响应结束或者关闭或者错误的时候执行一下onerror方法。[on-finished](https://github.com/jshttp/on-finished)

```jsx
handleRequest(ctx, fnMiddleware) {
	const res = ctx.res
	res.statusCode = 404
	const onerror = err => ctx.onerror(err)
	const handleResponse = () => respond(ctx)

	onFinished(res, onerror)
	return fnMiddleware(ctx).then(handleResponse).catch(onerror)
}
```

```jsx
function respond(ctx) {
	// allow bypassing koa
	if (false === ctx.respond) return

	if (!ctx.writable) return

	const res = ctx.res
	let body = ctx.body
	const code = ctx.status;

	// statuses.empty(code) returns true if a status code expects an empty body
	if (statuses.empty[code]) {
		// strip headers
		ctx.body = null
		return res.end()
	}

	if ('HEAD' === ctx.method) {
		if (!res.headersSent && !ctx.response.has('Content-Length')) {
			const { length } = ctx
			if (Number.isInteger(length)) ctx.length = length
		}
		return res.end()
	}

	// status body
	if (null === body) {
		if (ctx.reponse._expliciNullBody) {
			ctx.response.remove('Content-Type')
			ctx.response.remove('Transfer-Encoding')
			return res.end()
		}

		if (ctx.req.httpVersionMajaor >= 2) {
			body = String(code)
		} else {
			body = ctx.message || String(code)
		}
		if (!res.headersSend) {
			ctx.type = 'text'
			ctx.length = Buffer.byteLength(body)
		}
		return res.end(body)
	}

	// responses
	if (Buffer.isBuffer(body)) return res.end(body)
	if ('string' === typeof body) return res.end(body)
	if (body instanceof Stream) return body.pipe(res)

	// body: json
	body = JSON.stringify(body)
	if (!res.headersSent) {
		ctx.length = Buffer.byteLength(body)
	}
	res.end(body)
}
```

这里处理了不同类型的body，这里可以看到如果`res.headersSent`为false的话，会写一些header。

context, request, response

### context

```jsx
const COOKIES = Symbol('context#cookies')
const proto = module.exports = {
	inspect() {
		if (this === proto) return this
		return this.toJSON()
	},

	// 返回对象的所有json表示
	toJSON() {
		return {
			request: this.request.toJSON(),
			response: this.response.toJSON(),
			app: this.app.toJSON(),
			originalUrl: this.originalUrl,
			req: '<original node req>',
			res: '<original node res>',
			socket: '<original node socket>'
		}
	},

	// assertion
	assert: httpAssert,
	
	// throw error
	throw(...arg) {
		throw createError(...args)
	},

	// default error handling
	onerror(err) {
		//
	},

	// cookies
	get cookies() {
		if (!this[COOKIES]) {
			this[COOKIES] = new Cookie(this.req, this.res, {
				keys: this.app.keys,
				secure: this.request.secure
			})
		}
	},

	set cookies(_cookies) {
		this[COOKIES] = _cookies
	}
}

/**
 * Response delegation.
 */

delegate(proto, 'response')
  .method('attachment')
  .method('redirect')
  .method('remove')
  .method('vary')
  .method('has')
  .method('set')
  .method('append')
  .method('flushHeaders')
  .access('status')
  .access('message')
  .access('body')
  .access('length')
  .access('type')
  .access('lastModified')
  .access('etag')
  .getter('headerSent')
  .getter('writable');

/**
 * Request delegation.
 */

delegate(proto, 'request')
  .method('acceptsLanguages')
  .method('acceptsEncodings')
  .method('acceptsCharsets')
  .method('accepts')
  .method('get')
  .method('is')
  .access('querystring')
  .access('idempotent')
  .access('socket')
  .access('search')
  .access('method')
  .access('query')
  .access('path')
  .access('url')
  .access('accept')
  .getter('origin')
  .getter('href')
  .getter('subdomains')
  .getter('protocol')
  .getter('host')
  .getter('hostname')
  .getter('URL')
  .getter('header')
  .getter('headers')
  .getter('secure')
  .getter('stale')
  .getter('fresh')
  .getter('ips')
  .getter('ip');
```

context里写了很多setter，getter,并且使用[delegate](https://github.com/tj/node-delegates)把**request**，**response**的东西挂到委托到**context**上。

### request

```jsx
const IP = Symbol('context#ip')
module.exports = {
	get header() {
		return this.req.headers
	},
	set header(val) {
		this.req.headers = val
	},
	get url() {
		return this.req.url
	},
	set url(val) {
		this.req.url = val
	},
	get method() {
		return this.req.method
	},
	set method(val) {
		this.req.method = val	
	},
	get query() {
		const str = this.querystring;
		const c = this._querycache = this._querycache || {};
		return c[str] || (c[str] = qs.parse(str))
	},
	set query(obj) {
		this.querystring = q.stringify(obj)
	},
	get querystring() {
		if (!this.req) return ''
		return parse(this.req).query || ''
	},
	set querystring() {
		const url = parse(this.req)
		if (url.search === `?${str}`) return;
		
		url.search = str
		url.patch = null
		
		this.url = stringify(url)
	},
	get socket() {
		return this.socket
	},
	get length() {
		const len = this.get('Content-Length')
		if (len === '') return
		return ~~len
	},
	/**
   * Return request's remote address
   * When `app.proxy` is `true`, parse
   * the "X-Forwarded-For" ip address list and return the first one
   *
   * @return {String}
   * @api public
   */

  get ip() {
    if (!this[IP]) {
      this[IP] = this.ips[0] || this.socket.remoteAddress || '';
    }
    return this[IP];
  },

  set ip(_ip) {
    this[IP] = _ip;
  },
	get(field) {
    const req = this.req;
    switch (field = field.toLowerCase()) {
      case 'referer':
      case 'referrer':
        return req.headers.referrer || req.headers.referer || '';
      default:
        return req.headers[field] || '';
    }
  },
	/**
   * Return JSON representation.
   *
   * @return {Object}
   * @api public
   */

  toJSON() {
    return only(this, [
      'method',
      'url',
      'header'
    ]);
  }
}
```

可以看到这里也都是一些setter，getter，还有一些封装的方法比如get。

不过从代码中可以学习到一些编码技巧。

```jsx
const c = this._querycache = this._querycache || {}; // 存只避免多次访问
return ~~len // 位运算，这里相当于parseInt
```

位运算参考文章 [位运算符在JS中的妙用](https://juejin.im/post/5a98ea2f6fb9a028bb186f34)

上面代码还有一个比较意思的是，cookies和ip的访问都是用了Symbol。原因[参考](https://github.com/koajs/koa/pull/1216/commits/864da936d7005b4ef54e6c15b0bbac628472e3eb)

### response

与request 类似，不再贴代码。

## 测试

在package.json里script中

```jsx
"scripts": {
    "test": "egg-bin test test",
    "test-cov": "egg-bin cov test",
    "lint": "eslint benchmarks lib test",
    "bench": "make -C benchmarks",
    "authors": "git log --format='%aN <%aE>' | sort -u > AUTHORS"
},
```

可以看到这里功能测试使用的是egg-bin（mocha）

### 基准测试

`make -C benchmarks` ，首先可以了解一下[make](http://www.ruanyifeng.com/blog/2015/02/make.html)。-C是改变Makefile的读取目录，这里意思就是去benchmark目录下找Makefile文件。

```makefile
// benchmark/Makefile
all: middleware

middleware:
	@./run 1 false $@
	@./run 5 false $@
	@./run 10 false $@
	@./run 15 false $@
	@./run 20 false $@
	@./run 30 false $@
	@./run 50 false $@
	@./run 100 false $@
	@./run 1 true $@
	@./run 5 true $@
	@./run 10 true $@
	@./run 15 true $@
	@./run 20 true $@
	@./run 30 true $@
	@./run 50 true $@
	@./run 100 true $@
	@echo

.PHONY: all middleware
```

```makefile
// benchmark/middleware.js
'use strict';

const Koa = require('..');
const app = new Koa();

// number of middleware

let n = parseInt(process.env.MW || '1', 10);
const useAsync = process.env.USE_ASYNC === 'true';

console.log(`  ${n}${useAsync ? ' async' : ''} middleware`);

while (n--) {
  if (useAsync) {
    app.use(async(ctx, next) => next());
  } else {
    app.use((ctx, next) => next());
  }
}

const body = Buffer.from('Hello World');

if (useAsync) {
  app.use(async(ctx, next) => { await next(); ctx.body = body; });
} else {
  app.use((ctx, next) => next().then(() => ctx.body = body));
}

app.listen(3333);
```

### 功能测试

测试代码就不看了，有兴趣自己去github上看看。
