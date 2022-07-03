---
title: vue如何打包分发代码
date: 2022-07-03 17:59:30
description: 日益复杂的前端环境，vue是如何打包分发代码？
---


随着前端工程变得越来越复杂，各种构建工具也层出不穷，原生esm 的支持，同构应用需要在node 环境下运行代码，本文将以vue 框架入手，探讨库作者应该如何给不同场景提供不同的文件。<!-- more -->

首先可以知道vue 是一个monorepo的架构，各个子包都使用同一份rollup 配置文件进行打包。配置文件可以查看[vuejs/core rollup.js](https://github.com/vuejs/core/blob/main/rollup.config.js)。

```ts
const outputConfigs = {
  'esm-bundler': {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: `es`
  },
  'esm-browser': {
    file: resolve(`dist/${name}.esm-browser.js`),
    format: `es`
  },
  cjs: {
    file: resolve(`dist/${name}.cjs.js`),
    format: `cjs`
  },
  global: {
    file: resolve(`dist/${name}.global.js`),
    format: `iife`
  },
  // runtime-only builds, for main "vue" package only
  'esm-bundler-runtime': {
    file: resolve(`dist/${name}.runtime.esm-bundler.js`),
    format: `es`
  },
  'esm-browser-runtime': {
    file: resolve(`dist/${name}.runtime.esm-browser.js`),
    format: 'es'
  },
  'global-runtime': {
    file: resolve(`dist/${name}.runtime.global.js`),
    format: 'iife'
  }
}
```

在这里，name 就是包的名字。

```js
const isProductionBuild =
    process.env.__DEV__ === 'false' || /\.prod\.js$/.test(output.file)
const isBundlerESMBuild = /esm-bundler/.test(format)
const isBrowserESMBuild = /esm-browser/.test(format)
const isServerRenderer = name === 'server-renderer'
const isNodeBuild = format === 'cjs'
const isGlobalBuild = /global/.test(format)
const isCompatPackage = pkg.name === '@vue/compat'
const isCompatBuild = !!packageOptions.compat

const replacePlugin = createReplacePlugin(
	isProductionBuild,
	isBundlerESMBuild,
	isBrowserESMBuild,
	// isBrowserBuild?
	(isGlobalBuild || isBrowserESMBuild || isBundlerESMBuild) &&
	  !packageOptions.enableNonBrowserBranches,
	isGlobalBuild,
	isNodeBuild,
	isCompatBuild,
	isServerRenderer
)
```

```js
function createReplacePlugin(
  isProduction,
  isBundlerESMBuild,
  isBrowserESMBuild,
  isBrowserBuild,
  isGlobalBuild,
  isNodeBuild,
  isCompatBuild,
  isServerRenderer
) {
  const replacements = {
    __COMMIT__: `"${process.env.COMMIT}"`,
    __VERSION__: `"${masterVersion}"`,
    __DEV__: isBundlerESMBuild
      ? // preserve to be handled by bundlers
        `(process.env.NODE_ENV !== 'production')`
      : // hard coded dev/prod builds
        !isProduction,
    // this is only used during Vue's internal tests
    __TEST__: false,
    // If the build is expected to run directly in the browser (global / esm builds)
    __BROWSER__: isBrowserBuild,
    __GLOBAL__: isGlobalBuild,
    __ESM_BUNDLER__: isBundlerESMBuild,
    __ESM_BROWSER__: isBrowserESMBuild,
    // is targeting Node (SSR)?
    __NODE_JS__: isNodeBuild,
    // need SSR-specific branches?
    __SSR__: isNodeBuild || isBundlerESMBuild || isServerRenderer,

    // for compiler-sfc browser build inlined deps
    ...(isBrowserESMBuild
      ? {
          'process.env': '({})',
          'process.platform': '""',
          'process.stdout': 'null'
        }
      : {}),

    // 2.x compat build
    __COMPAT__: isCompatBuild,

    // feature flags
    __FEATURE_SUSPENSE__: true,
    __FEATURE_OPTIONS_API__: isBundlerESMBuild ? `__VUE_OPTIONS_API__` : true,
    __FEATURE_PROD_DEVTOOLS__: isBundlerESMBuild
      ? `__VUE_PROD_DEVTOOLS__`
      : false,
    ...(isProduction && isBrowserBuild
      ? {
          'context.onError(': `/*#__PURE__*/ context.onError(`,
          'emitError(': `/*#__PURE__*/ emitError(`,
          'createCompilerError(': `/*#__PURE__*/ createCompilerError(`,
          'createDOMCompilerError(': `/*#__PURE__*/ createDOMCompilerError(`
        }
      : {})
  }
 . // allow inline overrides like
  //__RUNTIME_COMPILE__=true yarn build runtime-core
  Object.keys(replacements).forEach(key => {
    if (key in process.env) {
      replacements[key] = process.env[key]
    }
  })
  return replace({
    // @ts-ignore
    values: replacements,
    preventAssignment: true
  })
}
```

可以看到根据 文件名可推断出很多信息，比如是否为生产环境，是否提供给 bundler 使用，是否为node 环境，然后根据这些信息，调用 在 replacePlugin 中做不同的替换。

再看下 [vue package.json](https://github.com/vuejs/core/blob/main/packages/vue/package.json)

```json
{
  "main": "index.js",
  "module": "dist/vue.runtime.esm-bundler.js",
  "types": "dist/vue.d.ts",
  "unpkg": "dist/vue.global.js",
  "jsdelivr": "dist/vue.global.js",
  "exports": {
    ".": {
      "import": {
        "node": "./index.mjs",
        "default": "./dist/vue.runtime.esm-bundler.js"
      },
      "require": "./index.js",
      "types": "./dist/vue.d.ts"
    },
    "./server-renderer": {
      "import": "./server-renderer/index.mjs",
      "require": "./server-renderer/index.js"
    },
    "./compiler-sfc": {
      "import": "./compiler-sfc/index.mjs",
      "require": "./compiler-sfc/index.js"
    },
    "./dist/*": "./dist/*",
    "./package.json": "./package.json",
    "./macros": "./macros.d.ts",
    "./macros-global": "./macros-global.d.ts",
    "./ref-macros": "./ref-macros.d.ts"
  },
}
```

exports 是 node 支持的字段，用来定义包的入口点，这种形式一般也叫 条件导出，参考[exports in nodes.js](http://nodejs.cn/api/packages.html#exports)

vue 的 `main` 入口指定的 `index.js` 是作为 commonjs 规范的入口文件

```js
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/vue.cjs.prod.js')
} else {
  module.exports = require('./dist/vue.cjs.js')
}
```

得益于commonjs 的动态特性，可以根据不同环境 使用不同的文件。为什么要这么做，可以看[How Does the Development Mode Work](https://overreacted.io/how-does-the-development-mode-work/) ， 而且[react](https://npm.runkit.com/react/index.js?t=1656841506637) 也是这么做的。打包工具 [tsdx](https://github.com/jaredpalmer/tsdx) 将这作为最佳实践打包代码。他作出的[解释](https://tsdx.io/optimization)是 通过这种方式，可以在开发模式中能够让你的库为用户提供更多的错误信息，而生产环境，这些提示代码就会被丢弃。当然，这依赖于end-user（终端用户，可以理解为使用你库的开发者）的环境变量设置，就目前而言，webpack，rollup 都是会在build 的时候将 `process.env.NODE_ENV` 设置为 'production', 其他环境则为 'development'。

对照着前面的outputConfig， createReplacePlugin的代码 以及 [vue readme](https://github.com/vuejs/core/blob/main/packages/vue/README.md) 的解释，我们可以对所有输出的文件用处做一个总结。

| 文件名 | 格式 | 用途 | 特点 |
| ----------------------------------- | ---- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| dist/vue.esm-bundler.js | esm | 给webpack，rollup，parcel这类打包工具使用。module字段 | 1. 保留诸如`process.env.NODE_ENV` 这类语句，留给bundler去替换； 2. 不需要minify；3. external dependencies |
| dist/vue.runtime.esm-bundler.js | esm | 同上 | 同上 但只包含运行时 |
| dist/vue.esm-browser.js | esm | 给通过浏览器 `<script type="module">` 直接使用 | 1. external dependencies； 2. `process.env.NODE_ENV` 要被替换为真正的值 |
| dist/vue.esm.runtime.esm-browser.js | esm | 同上 | 同上 但是 但包含vue运行时 |
| dist/vue.cjs.js | cjs | 在 main 字段中对应的文件中开发环境使用的文件，用在node环境 | 1. 将`process.env.NODE_ENV`替换为`"development"`； 2. 不minify；3. external dependencies |
| dist/vue.cjs.prod.js | cjs | 在 main 字段中对应的文件中生产环境使用的文件，用在node环境 | 1. 将`process.env.NODE_ENV`替换为`"production"`； 2. minify；3. external dependencies |
| dist/vue.global.js | iife | 通过`<script src="">` 直接导入，暴露Vue全局变量。unpkg, jsdeliver字段 | 1. 将 `process.env.NODE_ENV` 替换为 `"development"`； 2. 不minify；3. 打包所有依赖 |
| dist/vue.runtime.global.js | iife | 同上 | 同上，只包含运行时 |
| dist/vue.global.prod.js | iife | 同上 | 1. 将`process.env.NODE_ENV` 替换为 `"development"`；2. minify; 3. 打包所有依赖 |
| dist/vue.runtime.global.prod.js | iife | 同上 | 同上，只包含运行时 |

可以看到各种场景下的区别在于以下几点

1. 是否打包依赖
2. 是否需要压缩代码
3. 是否需要处理 `process.env.NODE_ENV`语句， 或者其他类似的替换
