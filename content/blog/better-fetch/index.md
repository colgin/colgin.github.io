---
title: 更好用的fetch
date: 2023-02-04
description: 你的新项目或许更应该使用fetch？

---

浏览器可以使用 [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) 和 [Fetch](https://developer.mozilla.org/zh-CN/docs/Web/API/Fetch_API) 来发送http请求，xhr API比较繁琐，但是兼容性好。fetch api 相对于 xhr 来说是更low-level的api，基本覆盖了xhr的所有功能，本文将介绍fetch相关的生态以及对于二者的一些思考。

<!-- more -->

## fetch

[fetch api spec](https://fetch.spec.whatwg.org/#fetch-api) 相对于 xhr 的几个优点：
1. no-cors
fetch 支持 `no-cors` 请求，使用xhr发送一个跨域请求 会因为服务端没有设置 [CORS headers](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CORS) 而失败，但是fetch 支持 `no-cors` 请求

```js
fetch('//whatever.com', {
	mode: 'no-cors'
}).then((resp) => {

})
```

这和请求一张图片是类似的，但是读不到响应的内容，不过可以被其他api消费到，比如在service-worker中

```js
self.addEventListener('fetch',
	function (event) {
		event.respondWith(fetch('//www.google.co.uk/images/srpr/logo11w.png', {
			mode: 'no-cors',
		}),
	);
});
```

2. stream
xhr 缺乏流的api，响应是内存中的一块buffer。而fetch提供了更加底层的用来操作数据流的api，`response.body` 是 [`ReadableStream` 类型](https://developer.mozilla.org/zh-CN/docs/Web/API/Response/body)。`Request` 和 `Response`对象上的 `.arrayBuffer()`, `.blob()` ,`.formData`，`.json()`, `.text()` 其实都是 stream reader。比如以最为常见的 `Response.json()`为例

```ts
response.json().then(data => {
	// you got the json object
})
```

`.json()`方法接收一个 `Response`流，然后将其读取完成，转化为json格式，所以 `.json()`返回的是一个 Promise对象。

当然 相对于 xhr 来说，fetch 也有暂时还实现不了的功能：
1. fetch api 无法监听上传进度事件
需要注意的是，fetch api 是可以通过 `response.body` 来监听响应进度的（download progress），因为它是 `ReadableStream` 类型，具体API可以参考 [ReadableStream spec](https://streams.spec.whatwg.org/#rs-class) , ReadableStream 可以一个chunk一个chunk的接收数据，只需要将已经接收到的chunk 的长度和响应的总长度做一下运算就可以得到进度，代码如下

```js
// Step 1: start the fetch and obtain a reader

let response = await fetch('https://api.github.com/repos/javascript-tutorial/en.javascript.info/commits?per_page=100');

const reader = response.body.getReader();

// Step 2: get total length
const contentLength = +response.headers.get('Content-Length');

// Step 3: read the data
let receivedLength = 0; // received that many bytes at the moment
let chunks = []; // array of received binary chunks (comprises the body)
while(true) {
	const {done, value} = await reader.read();
	if (done) {
		break;
	}
	chunks.push(value);
	receivedLength += value.length;
	console.log(`Received ${receivedLength} of ${contentLength}`)
}

// Step 4: concatenate chunks into single Uint8Array
let chunksAll = new Uint8Array(receivedLength); // (4.1)
let position = 0;
for(let chunk of chunks) {
	chunksAll.set(chunk, position); // (4.2)
	position += chunk.length;
}

// Step 5: decode into a string
let result = new TextDecoder("utf-8").decode(chunksAll);
// We're done!
let commits = JSON.parse(result);
alert(commits[0].author.login);
```

请求的上传进度 fetch 目前是不支持的，如果有场景需要使用到这个功能，要用 [XMLHttpRequest progress事件](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/progress_event)。


## 不是那么好用的fetch

fetch api 比 xhr 简单易用，但是也有一些需要注意的细节，比如可能会这么写

```js
fetch('/some')
	.then(res => res.json())
	.then(data => {
		// got data here
	})
	.catch(err => {})
```

根据[fetch文档](https://developer.mozilla.org/zh-CN/docs/Web/API/fetch)描述， 当遇到网络错误时，[`fetch()`](https://developer.mozilla.org/zh-CN/docs/Web/API/fetch) 返回的 promise 会被 reject，并传回 [`TypeError`](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/TypeError)，虽然这也可能因为权限或其它问题导致。成功的 fetch() 检查不仅要包括 promise 被 resolve，还要包括 [`Response.ok`](https://developer.mozilla.org/zh-CN/docs/Web/API/Response/ok) 属性为 true。HTTP 404 状态并不被认为是网络错误。

也就是说上面的代码如果遇到接口 `400`, `500` 也会走到 `res.json()` ，这有点不合理。因此需要额外处理一下请求错误

```ts
fetch('/some')
	.then(res => {
		if (!res.ok) {
			if(response.status === 404) throw new Error("Not found")
		    else if(response.status === 401) throw new Error("Unauthorized")
		    else if(response.status === 418) throw new Error("I'm a teapot !")
		    else throw new Error("Other error")
		}
		return res.json()
	})
	.then(data => {
		// got data here
	})
	.catch(err => {})
```


## 基于fetch的封装

由于直接使用fetch 比较不好用，所以社区中又很多基于fetch封装的工具，这里介绍几个，[ky](https://github.com/sindresorhus/ky), [wretch](https://github.com/elbywan/wretch)。

[ky](https://github.com/sindresorhus/ky) 的api 和 axios比较接近，支持拦截器，不过ky本身定位场景是现代的浏览器端，如果原生不支持`fetch`，需要自己手动引入 fetch polyfill，如果需要在同构场景使用（代码需要跑在浏览器端和node端），需要使用 [ky-universal](https://github.com/sindresorhus/ky-universal)。ky 的实现也很简单，有兴趣的读者可以自行查看。

```ts
import ky from 'ky';

const json = await ky.post('https://example.com', {json: {foo: true}}).json();

console.log(json);
```

[wretch](https://github.com/elbywan/wretch) 提供了链式api，通过插件提供扩展功能，代码也很少。

```ts
wretch("/some")
  .get()
  .notFound(error => { /* ... */ })
  .unauthorized(error => { /* ... */ })
  .error(418, error => { /* ... */ })
  .res(response => /* ... */)
  .catch(error => { /* uncaught errors */ })
```

```ts
// Cross origin authenticated requests on an external API
const externalApi = wretch("http://external.api") // Base url
  // Authorization header
  .auth(`Bearer ${token}`)
  // Cors fetch options
  .options({ credentials: "include", mode: "cors" })
  // Handle 403 errors
  .resolve((_) => _.forbidden(handle403));

// Fetch a resource
const resource = await externalApi
  // Add a custom header for this request
  .headers({ "If-Unmodified-Since": "Wed, 21 Oct 2015 07:28:00 GMT" })
  .get("/resource/1")
  .json(handleResource);

// Post a resource
externalApi
  .url("/resource")
  .post({ "Shiny new": "resource object" })
  .json(handleNewResourceResult);
```


## 思考

站在2023年这个时间节点，许多人都觉得，直接用[axios](https://github.com/axios/axios)就好了，确实，再过去几年，axios凭借着它简单易用的api以及可同在同构应用中使用，已经成为了许多项目的必备。axios在经过八年多不算很频繁地迭代，终于在 2022年10月份[发布了v.1.0.0](https://github.com/axios/axios/releases/tag/v1.0.0) 。axios依然在浏览器端仍然使用 XMLHttpRequest api的习惯。然而在这八年的时间里，fetch api已经得到了越来越多浏览器的支持，甚至可以说 现代浏览器都支持fetch，见[caniuse](https://caniuse.com/fetch)。aixos很多功能在 fetch 中都有更加精简的实现，这也是基于fetch封装的库会比axios小很多的原因。

另外一个需要注意的点在于，在边缘计算、serverless如火如荼的今天，很多 edge runtime 都会实现 fetch 而不会实现 XMLHttpRequest，因为 fetch 是属于 web 标准 api，而 XMLHttpRequest 是属于 browser api。而edge runtime本质来说是一个服务端环境。

Node在 v17.5 也[支持了fetch](https://github.com/nodejs/node/pull/41749)。[vercel edge runtime支持了一整套 fetch 的 api](https://edge-runtime.vercel.sh/features/available-apis) 。cloudflare worker runtime 使用了V8 引擎，同时也实现了包括 fetch 在内的很多现代浏览器的API，见[runtime apis](https://developers.cloudflare.com/workers/runtime-apis/)。deno 作为一个js runtime也同样实现了fetch 这种标砖的web api，见[deno fetch](https://deno.land/manual@v1.30.2/examples/fetch_data)。这也就意味着在这些实现了 fetch api的runtime中，你可以使用fetch，而XMLHttpRequest以及基于XMLHttpRequest封装的库就不能使用了。想象一下，如果在一个同构项目中或者一个需要跑在 deno runtime或者cloudflare workder环境中的代码中，使用一个基于fetch的库会比使用基于XMLHttpRequest的库体验更丝滑。

参考
- [Fetch API vs XMLHttpRequest](https://stackoverflow.com/questions/35549547/fetch-api-vs-xmlhttprequest)
- [That's so fetch](https://jakearchibald.com/2015/thats-so-fetch/#no-cors-and-opaque-responses)
- [fetch api spec](https://fetch.spec.whatwg.org/#fetch-api)
- [fetch download progress](https://javascript.info/fetch-progress)
- [You might be using `fetch` in JavaScript wrong](https://www.youtube.com/watch?v=Y6IUB5DxGN4)
- [ky](https://github.com/sindresorhus/ky)
- [axios](https://github.com/axios/axios)
- [wretch](https://github.com/elbywan/wretch)
- [fetch() In Node.js Core: Why You Should Care](https://stateful.com/blog/node-fetch)





