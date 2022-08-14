---
title: 基于rollup/webpack的上层打包工具
date: 2022-08-14 19:00:00
description: 还在用rollup/webpack打包？快来试试这些好用的新工具吧
---


尽管现在 rollup/webpack 功能已经很强大了，但是对于一个库的开发者来说，如何配置出一个最佳实践并不是一个简单的事情，因此社区中有很多机遇rollup/webpack封装的打包工具，每个工具都各有特点，让开发者能够不用关心打包的问题，一个命令就输出符合最佳实践的产物。本文将介绍多种不同的打包工具，并进行横向比较，探究他们的技术选型以及种种权衡。


|  | tsup | tsdx | unbuild | microbundle | ncc | bunchee | pkgroll | bundt |
| ----------------- | -------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------- | ------------------------------ | -------------- | ----------------- | ------------------------- |
| star | 3000 | 10100 | 790 | 7200 | 7000 | 154 | 118 | 157 |
| author | egoist | jaredpalmer | unjs/nuxt | developit | vercel | huozi | privatenumber | lukeed |
| underhood | rollup + esbuild | rollup + babel | rollup + esbuild | rollup + babel | webpack | rollup + swc | rollup + esbuild | string replacement |
| ts support | yes | yes | yes | yes | yes | yes | yes | no |
| compiler | esbuild | babel | esbuild | babel | 无 | swc | esbuild | 无 |
| output format | esm + cjs + iife | cjs, esm, umd | esm + cjs | esm + cjs + umd | cjs or mjs(只输出node环境代码) | cjs, esm， umd | esm, cjs | esm,cjs,umd |
| global env | 支持所有，需要在配置中加上需要替换的值 | 默认只支持 `_DEV_`和`process.env.NODE_ENV`，其他需要自定义rollup实现 | 本身不做替换 ，如果要替换通过rollup配置替换 | 支持，cli上 --define可以配置 | | 无 | 支持替换 | 不支持，保留 |
| es version | es6+ ， es5 by swc | babel自己配置 | es2020，不可配置 | es6 + mordern mode | 无 | es5 | es6+ | 无 |
| declareation file | yes | yes | yes | yes | ？ | yes | yes | 无 |
| config | 单独配置文件，package.json, cli | 单独配置文件，cli | 单独的配置文件，package.json | cli, package.json | cli, package.json | cli | cli, package.json | package.json, cli |
| others | 支持多入口 | 有初始化程序，有多种模板，天然支持react + ts | 开箱即用的vue支持，支持bundless output，支持Passive watcher | 支持css module，worker输出 | inline all dependencies |                | | external all dependencies |

## 可配置

上面工具基本都是底层工具的上层封装，为了不将api 设计地过于臃肿，有的就直接利用 package.json 里的字段，有的通过命令行指定，有的支持单独的配置文件。

## compiler

### esbuild

esbuild 的特点是 快，以及开箱即用的 ts 支持，但是esbuild 最低只支持 编译到 es6，而且不支持 polyfill，如果你的库使用到了一些非常新的api，你可能需要自己从 `core-js` 中导入 polyfill。具体参考[esbuild#target](https://esbuild.github.io/api/#target)。

>Note that this is only concerned with syntax features, not APIs. It does _not_ automatically add [polyfills](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill) for new APIs that are not used by these environments. You will have to explicitly import polyfills for the APIs you need (e.g. by importing [`core-js`](https://www.npmjs.com/package/core-js)). Automatic polyfill injection is outside of esbuild's scope.

除此之外，esbuild 对于 js 的编译文件也有一些[限制](https://esbuild.github.io/content-types/#javascript-caveats)
- 不支持编译到es5
- `#name` private member 有性能问题
- 不可直接使用 eval 函数

esbuild 对于 ts 的编译也有一些[限制](https://esbuild.github.io/content-types/#typescript-caveats)
- 无法生成 `d.ts`

### swc

swc 和 esbuild 一样可以做代码的编译器，开箱即用的 ts 支持，与esbuild比较起来，swc 可以将代码编译到 es5。比如 tsup 当 `--target es5` 时，就会先用 esbuild 编译到 es6， 然后再用 swc 将 es6 代码编译到 es5.

### babel

最常见的，不过多介绍

### buble

buble 早期被定义为babel 的替代品，用来解决babel的一些问题，不过随着babel的发展，加上buble长时间不更新，现在基本很少用buble作为转译器了。microbundle 早期就是用 buble 进行转译，在[pr](https://github.com/developit/microbundle/pull/263) 中替换成了babel

## 输出文件

使用esbuild 或者 babel 处理 js其实都无法生成 `d.ts`, 然而作为一个使用 `ts` 书写的库，提供可靠的 类型文件是非常有必要的，因此大部分打包器都支持 生成一份最后的 类型文件

### bundless output

大部分打包器 都会将所有的文件打包在一个文件，然后以一种特定的格式输出。但是像 unbuild 这类工具，提供了一种新的输出，就是只做 file-to-file 的编译工作，输出和输入的代码结构保持一致。

```ts
import {defineBuildConfig} from 'unbuild'

export default defineBuildConfig({
	entries: [
		// default
		'src/index',
		// mkdist builder transpiles file-to-file keeping original sources structure
		{
			builder: 'mkdist',
			input: './src/',
			outDir: 'esm'
		}
	],
	declaration: true
})
```

### 全局变量

有时候会在代码里写
```ts
funciton foo() {
	if (process.env.NODE_ENV !== 'production') {
		console.warn('xx')
	}
}
```

通过这种方式，可以在 开发环境做一些友好的提示。但是很多打包器都会在打包的时候把这些变量进行替换，比如 tsup 可以通过 `tsup src/index.ts --env.NODE_ENV production` 来替换全局变量，这样打包的结果就变成了
```ts
function foo() {
	if (false) {
		console.warn('xx')
	}
}
```
（注：这种代码经过代码压缩之后 整个 if 代码块都会被移除）

所以 当用户使用你的库的时候，实际上是看不到 任何提示的，因为你打包的时候已经把这些提示移除了。这显然是不太友好的，tsdx 针对 这种情况 提出了一个最佳实践。见[Development-only Expressions + Treeshaking](https://tsdx.io/optimization#development-only-expressions-treeshaking)

比如针对源文件

```tsx
// ./src/index.ts
export const sum = (a: number, b: number) => {
	if (process.env.NODE_ENV !== 'production') {
		console.log('Helpful dev-only error message');
	}
	return a + b;
};
```

会生成 3 个 commonjs文件 (dev, prod, entry)

```js
// Entry File
// ./dist/index.js'use strict';
// This determines which build to use based on the `NODE_ENV` of your end user.
if (process.env.NODE_ENV === 'production') {
	module.exports = require('./mylib.cjs.production.js');
} else {
	module.exports = require('./mylib.cjs.development.js');
}
```

```js
// CommonJS Development Build
// ./dist/mylib.cjs.development.js'
use strict';
const sum = (a, b) => {
	{
		console.log('Helpful dev-only error message');
	}
	return a + b;
};
exports.sum = sum;
//# sourceMappingURL=mylib.cjs.development.js.map
```

```js
// CommonJS Production Build
// ./dist/mylib.cjs.production.js
'use strict';
exports.sum = (s, t) => s + t;
//# sourceMappingURL=test-react-tsdx.cjs.production.js.map
```

可以看到通过这种方式 可以区分 production 和 development 两种不同环境了，而且也不会影响产物的size。

而 ESM，这些环境变量会保留不会做替换，留给终端用户去做替换（webpack，rollup 都会自动处理 NODE_ENV 的替换)

[React](https://github.com/facebook/react/blob/main/packages/react/npm/index.js) 和 [Vue](https://github.com/vuejs/core/blob/main/packages/vue/index.js) 其实都采用了类似的策略

```ts
'use strict';

if (process.env.NODE_ENV === 'production') {
	module.exports = require('./cjs/react.production.min.js');
} else {
	module.exports = require('./cjs/react.development.js');
}
```

### external

外部依赖要不要打包进最终的产物，这是一个看似简单，其实工程上需要考虑多一些，因为无论既可以打包进去，也可以不打包进去，二者各有优缺点，本文不做深入讲解。各个打包工具的大概有以下几种选择

- 依赖打包进去，比如 ncc
- peerDependencies, dependencies 全部 external， devDependencies 全部打包: 比如 pkgroll, tsup
- 依赖全部 external，比如 bundt
- 自行配置

其实 大部分 都是选择第二种方案，这也是大家默认的最佳实践。具体原因参考 [How Microbundle decides which dependencies to bunlde](https://github.com/developit/microbundle/wiki/How-Microbundle-decides-which-dependencies-to-bundle)

## ESM 和 commonjs 的兼容性

node 中有一些 api 在 esm中并不支持，比如 `__dirname`, `__filename`, `require`, `require.resolve`。同理 esm 有一些变量在 node 中也不支持，比如 `import.meta.url` 。这些转化 底层的 esbuild 其实都没有处理，见 [bundling-for-node](https://esbuild.github.io/getting-started/#bundling-for-node)。

本文中一些打包器有时候会宣称自己是 **Node.js ESM** <=> **CJS friendly**, 他们往往会做一些处理。比如

commonjs 中的 require 会被 编译为 `createRequire(import.meta.url)`

如果代码中使用到了 `import.meta.url`

```ts
export function consoleImportUrl() {
	console.log(import.meta.url)
}
```

microbundle esm 中的 `import.meta.url` 会被编译为

```ts
exports.consoleImportUrl = function() {
	console.log('undefined' === typeof document
	? new (require("url").URL)("file:" + __filename).href
	: document.currentScript && document.currentScript.src || new URL("foo.js", document.baseURI).href)
}
```

而tsup 默认只则只做了简单的shim
```ts
var import_meta = {};
function consoleImportUrl() {
	console.log(import_meta.url);
}
```

可以通过 `--shims` 可以加上类似于 microbundle 那种完整的兼容代码。见[tsup release6.0](https://github.com/egoist/tsup/releases)

commonjs 中的 `__dirname` 会被编译为

```ts
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const _dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : dirname(fileURLToPath(import.meta.url))
```

- [pkgroll: esm <=> cjs interoperability](https://github.com/privatenumber/pkgroll#esm--cjs-interoperability)
- [Context misalignment](https://antfu.me/posts/publish-esm-and-cjs#context-misalignment)

## 非 ts/js 文件支持

除了 ts/js 文件之外，实际的项目还可能有比如 ，json，jsx，css 等各种格式的文件，不同打包器对这类文件支持程度也不一样。

tsup 由于使用了 esbuild，esbuild 中有很多内置的[loader](https://esbuild.github.io/content-types/)，

```ts
type Loader =
  | 'js'
  | 'jsx'
  | 'ts'
  | 'tsx'
  | 'css'
  | 'json'
  | 'text'
  | 'base64'
  | 'file'
  | 'dataurl'
  | 'binary'
  | 'default'

```

可以通过 `--loader ".jpg=base64"` 使用 `base64` loader 去加载 `.jpg` 文件

## watch模式

通过上面的表格可以知道，他们都是基于 rollup / webpack 的二次封装，rollup 和 webpack 都有 watch 模式，因此这些打包器的监听模式也是基于 rollup/webpack 的监听模式实现的，会开启一个进程，监控所有文件，当文件发生变化的时候，重新进行打包。

unbuild 提供了一种新思路，叫做 `passive watcher`, 也叫 stub 模式，通过 `unbuild --stub` 可以一次生成目标文件，之后无论你原代码如何修改，都不会重新编译构建。这取决于 [jiti](https://github.com/unjs/jiti) 这个神奇的包

通过 `unbuild --stub` 生成的文件如下

```ts
import jiti from "jiti";

/** @type {import("/xx/yy/src/index")} */

const _module = jiti(null, { interopDefault: true, esmResolve: true })("/xx/yy/src/index.ts");
```

可以看到 通过 `jiti` 将源文件进行了绑定，所以其他地方引用这个包时，实际上引用的是源文件。通过这种方式，不再需要启动一个 watch 进程！


## 推荐

按照 star 数量来说的话，数量越高，说明越活跃。tsdx  是最高的，功能也很完备，但是 [tsdx作者不维护tsdx](https://github.com/jaredpalmer/tsdx/issues/1058) 。tsup 功能也很强大，unbuild 的 bundless build 很特别， stub 模式可以大大提升开发效率。ncc 将所有依赖都打包进最终产物，使得一些需要固定依赖版本的场景非常有用（比如[umi 就使用ncc预编译所有的依赖](https://github.com/umijs/umi/blob/284b25ad9cde67f2d90b74e1f5df252675bea9bd/scripts/bundleDeps.ts))
