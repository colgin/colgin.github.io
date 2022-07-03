---
title: package.json中的module字段
date: 2022-05-03 18:33:53
description: module字段，你不知道的一些事
---

package.json里的module字段，作为前端开发者来说再熟悉不过了，今天笔者站在2022年的角度简单说下这个字段。<!-- more -->

自从Node.js诞生以来，commonjs成为了模块规范。而在之后的ES规范中，JavaScript却重新定义了一个模块规范-ESM。ESM有很多[优点](https://github.com/rollup/rollup/wiki/ES6-modules)，比如静态分析，这也是tree-shaking的基础。作为库开发者，如何提供给Node和浏览器端不同的代码成为早起工程化的一个难点。

之前一般都需要在package.json中声明`main` 字段告知模块解析器如何找到对应的文件，随着esm的流行，就有[提议](https://github.com/dherman/defense-of-dot-js/blob/master/proposal.md)加一个新的字段 `module`只想 符合esm规范的文件，这样解析器就可以通过这个字段找到esm文件，这样就可以对代码进行tree-shaking，移除掉dead
 code。之后打包工具[rollup](https://github.com/rollup/rollup)作者也在 [rollup wiki](https://github.com/rollup/rollup/wiki/pkg.module)中 提倡库的开发者提供`module` 字段指向 esm 文件，rollup在浏览器端会优先从module字段去解析对应的文件，由于该文件是esm规范的，所以可以很好的tree-shaking。之后webpack也支持了这个`module`字段，再之后很多基于rollup/webpack的上层工具也支持了这个字段。之后，这似乎成为了一种默认事实和最佳实践。

 可是，到目前为止，[module字段一直都不是 官方字段](https://stackoverflow.com/questions/42708484/what-is-the-module-package-json-field-for/42817320#42817320)，node之后使用`exports`字段来解决不同环境下文件指向问题，`exports`字段比`module`更加明确，据 [node官方文档](https://nodejs.org/api/packages.html#exports)解释，`exports` 可以支持定义subpath exports和 conditional exports

 ```json
{
  "main": "./main.js",
  "exports": {
    ".": "./main.js",
    "./submodule": "./src/submodule.js"
  }
}
 ```
 比如这样定义`exports`字段

 ```js
import submodule from 'es-module-package/submodule';
// Loads ./node_modules/es-module-package/src/submodule.js
 ```

 而所谓的conditional exports就是根据宿主环境使用不同的文件

 ```json
 {
  "main": "./main-require.cjs",
  "exports": {
    "import": "./main-module.js",
    "require": "./main-require.cjs"
  },
  "type": "module"
}
 ```

 二者甚至还可以结合起来
 ```json
{
  "main": "./main.js",
  "exports": {
    ".": "./main.js",
    "./feature": {
      "node": "./feature-node.js",
      "default": "./feature.js"
    }
  }
}
 ```

 可以看到`exports`字段比单纯的module字段表现力更加强。需要补充的是Node也支持了 ESM，可通过 `type: module`来让node以加载esm模块，或者使用 `.mjs`文件来让node以esm规范加载模块。可参考[package.type](https://nodejs.org/api/packages.html#type)。

可以看到，由于浏览器端和服务器端都使用了js，而js本身模块化标准方案出现的时间又比社区方案晚了很久，加上二者加载模块的侧重点不一样（web端在native esm之前需要考虑打包文件的尺寸，而Node端则不需要考虑这些，因为代码都会被下载到磁盘），导致规范到两端可用需要很长的时间（比如esm），社区提出的实践也很难兼顾到各个方面，所以导致了如此混乱的局面。

说到这里，你可能已经很混乱了，我到底要怎么用这几个字段呢？作为应用的开发者，你应该不需要考虑这个问题，前端应用一般都会使用诸如webpack, rollup这类打包工具，在某种程度上，这些工具已经负责帮你处理好了模块解析的问题，而后端应用，本身就会将依赖的三方包都下载下来，Node在运行时加载，只要选择兼容了Node环境的第三方包就不会有问题。而针对库的开发者来说，这个问题就很值得重视了，这里建议考虑好你的库需要支持的环境，在不同的环境是否需要不同的模块支持，这里我建议参考 [esbuild关于main fields的解释](https://nodejs.org/api/packages.html#type)，以下是原文翻译
> main fields
当你在node中导入一个包时，package.json中的main字段决定了要导入的文件（需要配合一系列[规则](https://nodejs.org/api/modules.html#modules_all_together)）。主流的JavaScript打包器包括esbuild会让你在package.json中额外声明一个字段用来解析模块，在社区中至少有如下三个字段
- main 这是一个Node模块中的一个标准字段，`main` 这个名字时在node 的模块解析逻辑里硬编码的，因为这是设计给Node使用的，所以希望这个字段指定为一个 commonjs 风格的模块
- module 这个字段来自于一个讲ESM 集成进Node的一个[提议](https://github.com/dherman/defense-of-dot-js/blob/f31319be735b21739756b87d551f6711bd7aa283/proposal.md), 因此这个字段希望指定为一个符合es规范的模块。这个提议没有被Node采纳（Node使用 type: 'module'），但是这个提议被很多主流的打包器所采纳，从而带来了 [tree-shaking](https://esbuild.github.io/api/#tree-shaking)或者叫移除未使用的代码。对于包作者来说，有一些开发者错误地将`module`字段指定为针对浏览器端的代码，将针对node端的代码放到`main`字段中。这可能是因为node会忽略`module`字段，而且人们仅在浏览器应用上会使用打包器。可是，打包node环境的代码也是很有价值的（这会大大降低下载时间和启动时间），在`module`中放一些浏览器端特定的代码会导致打包器无法正确有效的tree-shaking。如果你要发一个只针对浏览器端的包，使用`browser`字段就好了
- browser 这个字段来自于一个[提议](https://gist.github.com/defunctzombie/4339901/49493836fb873ddaa4b8a7aa0ef2352119f69211)，可以让打包工具能够将一个node特定的包换成浏览器端的包。它允许你指定一个额外的针对浏览器端的入口。需要注意的是，一个模块可能使用了 `browser`和`module`字段

默认使用的main 字段取决于当前platform设置，本质上就是 浏览器端使用`browser`, `module`, `main`, Node端使用`main`,`module`。
针对库作者来说，如果你想将`browser`和`module`一起使用来达到 commonjs + esm 与 browser + node四种环境的兼容，你可以将`browser`定义为一个 map而不是一个字符串

```json
{
  "main": "./node-cjs.js",
  "module": "./node-esm.js",
  "browser": {
    "./node-cjs.js": "./browser-cjs.js",
    "./node-esm.js": "./browser-esm.js"
  }
}
```
