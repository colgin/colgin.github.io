---
title: package.json里的main字段
date: 2020-06-07 00:10:03
description: package.json里的main字段，再平常不过了
---

package.json是一个JavaScript的项目描述文件，其中main字段是非常重要的一个字段，它描述了程序的入口。本文将分析作为一个模块（不是应用）的main字段。

<!--more-->

## main vs module

main字段是程序的入口，在[npm官网](The main field is a module ID that is the primary entry point to your program. That is, if your package is named foo, and a user installs it, and then does require("foo"), then your main module’s exports object will be returned.  This should be a module ID relative to the root of your package folder.  For m)有这么一段描述

- The main field is a module ID that is the primary entry point to your program. That is, if your package is named **`foo`**, and a user installs it, and then does **`require("foo")`**, then your main module’s exports object will be returned
- This should be a module ID relative to the root of your package folder.

main字段是commonJS规范的入口文件，对于客户端应用来说，如果使用webpack或者rollup这样的现代化打包器打包应用的话，其实优先考虑的是module字段，如果module字段没有值的话，才会使用main字段。具体看 [pkg.module](https://github.com/rollup/rollup/wiki/pkg.module)

## main的指向

在看一些开源代码库的实现的时候，关于main字段有一些不一样的理解。

比如[vuex](https://github.com/vuejs/vuex)中package.json是这样的

```json
{
	...
	"main": "dist/vuex.common.js",
	"module": "dist/vuex.esm.js",
	"unpkg": "dist/vuex.js",
	"jsdelivr": "dist/vuex.js",
	"typings": "types/index.d.ts"
	"files": [
		"dist",
		"types/index.d.ts",
		"types/helper.d.ts",
		"types/vue.d.ts"
	]
}
```

可以看到这里的main指向了一个使用rollup打包的开发版本的commonjs格式的打包后的文件。module指向的是一个使用rollup打包的开发版本的esm格式的包。其他诸如jsdelivr, unpkg使用的都是开发rollup打包的umd格式的包。vuex的dist目录会被推送到github，当包的使用中使用`npm install`安装包的时候，dist目录也会存在与node_modules/vuex目录下。

在另一个知名的包[axios](https://github.com/axios/axios/)的package.json里就和vuex有些区别

```json
{
	...
	"main": "index.js",
	"browser": {
		"./lib/adapters/http.js": "./lib/adapters/xhr.js"
	},
	"jsdelivr": "dist/axios.min.js",
	"unpkg": "dist/axios/min.js"
}
```

这package.json没files字段，说明安装的时候，项目的所有文件夹和根目录下非配置文件都会被安装进去，其实也就只有两个文件夹（lib目录和dist目录）。

axios由于一个前后端都可以使用的库，前后端发出请求的方式不一样，前端使用xhr对象，后端使用的是http库，所以这里有一个browser字段表示在浏览器端把某一个文件的导入换成另外一个文件。

axios 的package.json没有module目录，说明如果模块被一个客户端应用使用的话，打包器的入口也是main指向的地址。这个main的地址指向了一个源文件，并不是打包后的文件。这里和之前的vuex有明显的不一样。

## 思考

一个包（模块）在一个应用中是如何被使用的？

一般来说会有两种方式

1. 直接通过script标签引入
2. 通过require或者import方式引入，加上打包工具(webpack, rollup)

第一种方式通常会使用一个dist目录的压缩版本的umd格式的包，使用cdn或者其他方式引入。此处不细讲。

前面我们说到，打包工具一般会使用module/main 字段作为包的入口文件。这里先讨论main，main一般来说会有三种取值

1. 指向源代码文件 （如axios）
2. 指向打包后的开发版本（如vuex）
3. 指向打包后的生产版本

先讨论第一种与第二中的区别

如果使用源码作为入口文件的话，就需要使用者自行对这个模块进行打包处理，而由于使用webpack这类打包工具的时候，往往会配置babel-loader 把node_modules给exclude掉，这也就意味着不会对这个包进行转译。如果这个包里出现了es6或者更高级的特性的话，可能会在应用层上会出现不兼容的问题。而且对node_modules里的包进行处理，会导致编译速度变慢。

所以如果是在客户端使用的包，包的开发者不应该使用源代码作为入口。如果包的目标运行环境只是在node端，由于node端不需要对源代码进行编译打包，所以可以将源文件作为入口文件。

再讨论第二种与第三种的区别：

我们看到vuex的module字段指向的是一个开发版本的编译包。开发版本和生产版本有什么区别呢？

1. 开发版本一般不会进行压缩，利于在包的使用者在开发过程中进行调试，保持源代码的可读性。
2. 开发版本一般会有一些警告信息。这些警告信息，一般源码是这样实现的，这些代码一样会被放到开发版本的包文件中。

```jsx
if (process.env.NODE_ENV === 'development') {
	console.warn()
}
```

如果使用webpack的话，会使用[DefinePlugin](https://webpack.js.org/plugins/define-plugin/)来定义环境变量。如果在开发环境的话，NODE_ENV就是'development'了，那么警告信息就会被打印出来。

所以可以看到vuex的module和main指向的不同模块格式的开发版本的包，这让你在开发的时候，有很好的开发体验，会有报错信息。

等你将你的应用代码打包上线的时候，打包工具会将环境变量设置为production，那么那些所有的判断都为false了，所以就不会进入那些警告的逻辑了。同时，还会启用minify将代码进行压缩，会删除用不到的代码。所以生产版本就看不到警告了。

## 再看开源库

前面我们看了vuex和axios，看起来vuex的实现更加标准一些。axios的只有一个main字段（client 和server端公用一个入口），如果使用者不加转译的话，axios里如果用了一些目标浏览器不支持的新特性的话，就会出现兼容性问题。

axios和vuex都将dist目录推送到github

再看[mobx](https://github.com/mobxjs/mobx/issues/1922)的实现， mobx和axios一样可以在client,server端使用。

```json
{
  "main": "lib/index.js",
  "umd:main": "lib/mobx.umd.js",
  "module": "lib/mobx.module.js",
  "unpkg": "lib/mobx.umd.min.js",
  "jsnext:main": "lib/mobx.module.js",
  "typings": "lib/mobx.esm.js",
  "files": [
  	"lib",
  	"LICENSE"
  ],
}
```

这里main指向的是源码文件，其他的都是打包后的文件。而且还要知道的是mobx并没有把lib目录push到github，而只是把lib目录push到了npm上。



参考：

[关于package.json中main字段的指向问题](https://jingsam.github.io/2018/03/12/npm-main.html)

[npm doc](https://docs.npmjs.com/files/package.json)
