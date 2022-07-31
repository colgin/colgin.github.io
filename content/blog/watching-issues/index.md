---
title: watching-issues.md
date: 2022-01-31 12:31:35
description: 从issue中观察学习
---

日常开发学习过程中，会遇到一些奇怪的问题。这些问题的背后要么隐藏了作者对工程项目的理解，要么由于历史原因久久搁置成为我们使用的绊脚石。<!--more-->

[React:Add a "module" entry in package.json to export ES2015 version of React](https://github.com/facebook/react/issues/10021)

原因是收益很小，其实感觉还是可以做的，只不过React团队认为这个优先级不高

[vue-qrcode:Treat qrcode as dependency rather than peerDependency](https://github.com/fengyuanchen/vue-qrcode/issues/44)

如果是peerDependency，用户可以自己手动选择安装那个版本额qrcode，如果是dependency的话，用户无法决定，也无需手动安装。

[vite:Lib mode should export types](https://github.com/vitejs/vite/issues/3461)

vite本身不会提供生成类型文件的能力，如果是纯ts 项目可以使用tsup这样的工具。如果含有vue组件，可以配置typescript插件生成类型文件，需要指定`enforce：pre`(此方法由本来提出，思路参考[issue](https://github.com/harrytran998/rep-vite-bunlder-vue-ts/issues/1#issuecomment-845233883)), 或者使用[vite-dts-plugin](https://github.com/qmhc/vite-plugin-dts)

[sindresorhus:Why don't you add ES5 transpiled code to your modules for browsers?](https://github.com/sindresorhus/ama/issues/446)

探讨库作者要不要提供转译好的代码，转译到es5还是es6？

[Add flag to not transpile dynamic import() when module is CommonJS](https://github.com/microsoft/TypeScript/issues/43329)
Node 12+ 已经支持 dynamic import 语句，这也是 node 中使用纯 esm 模块的唯一方式，但是这个语句，tsc 会将其编译为 `require` 语句。

[Pure ESM package](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c)

esm 已经被 Node 原生支持了，[Chalk 5.0](https://github.com/chalk/chalk/releases/tag/v5.0.0) 已经只导出 esm 格式的文件了。