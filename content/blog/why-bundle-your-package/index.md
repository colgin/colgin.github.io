---
title: 你为什么打包你的库
date: 2022-05-03 21:38:35
description: 不打包不行吗？
---

对于库作者来说，你为什么要打包你的package这个问题听起来很刺耳，因为好像这个问题挺怪的，因为大家看到的实践就是，写库的时候，用rollup打包一下，然后把打包后的文件放到package.json里的module或者main字段，大家都这么做，所以我也这么做，但是真的是这样吗？<!-- more -->

打包做了什么，
Why bundle Node.js packages?
ESM and CommonJS outputs

As the Node.js ecosystem migrates to ESM, there will be both ESM and CommonJS users. A bundler helps accommodate both distribution types.  and unnecessary files (eg. README.md, package.json, etc.) from getting downloaded.

Removing dependencies also eliminates dependency tree traversal, which is one of the biggest bottlenecks.

Inadvertent breaking changes

Dependencies can introduce breaking changes due to a discrepancy in environment support criteria, by accident, or in rare circumstances, maliciously.

Compiling dependencies will make sure new syntax & features are downgraded to support the same environments. And also prevent any unexpected changes from sneaking in during installation.

Type dependencies must be declared in the dependencies object in package.json for it to be resolved by the consumer.

This can be unintuitive because types are a development enhancement and also adds installation bloat. Bundling filters out unused types and allows type dependencies to be declared in devDependencies.

Minification strips dead-code, comments, white-space, and shortens variable names.
