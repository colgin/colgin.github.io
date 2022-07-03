---
title: NodeJS模块机制
date: 2017-11-16 22:13:32
description: 给一个原本没有模块规范的语言引入模块，一定不是一个简单的事
---

## CommonJS 规范

### 出发点

JavaScript 存在缺陷，导致在后端其无法用来开发大型应用

<!--more-->

> - 没有模块系统
> - 标准库少。文件操作，I/O 流都没有标准 API
> - 没有标准接口。与 web 服务器或者数据库的接口
> - 缺乏包管理

### 具体规范

1. 模块引用 **require**
2. 模块定义
   > 需要注意的是，上下文提供 exports 对象用于导出当前模块的方法和变量，并且它是唯一导出的出口。而在模块中
   > 还存在一个 module 对象，它代表模块自身，exports 是 module 的属性。在 Node 中，一个文件就是一个模块，可以将方法挂载在 exports 对象上作为属性即可定义导出的方式。
3. 模块标识
   模块标识就是 require()方法的参数，必须是符合小驼峰命名的字符串，或者以 .、..开头的相对路径。可以没有文件后缀.js

## Node 实现

引入模块的三个步骤

1. 路径分析
2. 文件定位
3. 编译执行
   不同类别模块加载的区别
4. 核心模块(_Node 提供_)：在 Node 源代码编译过程中，编译进了二进制执行文件。在 Node 进程启动时，部分核心模块直接被加载进内存中(没有文件定位和编译执行的过程)，加载速度很快
5. 文件模块(_用户编写_)：在运行时动态加载，需要历经路径分析，文件定位，编译执行过程，比核心模块慢一些

### 路径分析

. 核心模块：优先级仅次于缓存加载，被编译成二进制
. 路径形式的文件模块(相对定位 OR 绝对定位)：当成文件模块来处理。转化成真实路径，并且将编译执行后的结果放入缓存中
. 自定义模块

> 自定义模块指的是非核心模块，同时也不是路径形式的标识符。可以认为是一种特殊的文件模块，可能是一个文件或者包的形式，查找比较费时。其实可以理解为你在网络上安装的第三方包。

查找策略

- 当前目录下的 node_modules
- 父目录下的 node_modules
- 沿路径向上递归，知道根目录下的 node_modules

### 文件定位

#### 扩展名分析

标识符不包含文件名，Node 会按照.js、.node、.json 的次序补足，依次尝试

#### 目录分析和包

分析完加扩展名的标识符后，可能还没有找到对应文件，但可以得到一个目录。Node 会自动将该目录当做一个包来处理。Node（CommonJS 规范）首先会在当前目录下找到 package.json 文件，找到 main 字段，对该文件名进行定位。如果没有找到，则会将 index 作为默认文件名，依次查找 index.js、index.node、index.json。如果还没有找到则进入下一个模块路径进行同样方式的查找

### 模块编译

Node 中每个文件模块都是一个对象。构造函数定义如下

```javascript
function Module(id, parent) {
  this.id = id
  this.export = {}
  this.parent = parent
  if (parent && parent.children) {
    parent.children.push(this)
  }
  this.filename = null
  this.loaded = false
  this.children = []
}
```

不同类型的文件（扩展名不一样），Node 会采用不同的读取方式

#### 模块的载入（模块的读取）

- .js 文件。通过 fs 模块同步读取文件
- .node 文件。用 c/c++编写的扩展文件，通过 dlopen()方法加载最后编译生成文件
- .json 文件。通过 fs 模块同步读取后，用 JSON.parse()解析并且返回结果
- 其他类型 。按照 js 文件方法载入

#### JavaScript 模块的编译

Node 会对获取的 JavaScript 文件进行头尾包装

```javascript
;(function (exports, require, module, __filename, __dirname) {
  var math = require('math')
  exports.add = function () {}
})
```

然后通过 vm 原生模块的 runInThisContenxt()方法执行（类似 eval，但是有明确上下文，不污染全局环境），返回一个 function 对象，最后将当前模块对象的 exports，require...等参数传入这个 function()执行。执行之后，模块的 exports 属性会返回给调用方

> 这也是为什么这些变量没有定义在模块文件，却可以使用的原因。
> 同时需要注意的是这里的 module.exports 和 exports 之间的关系。在模块内部是不能直接将值赋给 exports 对象，因为 exports 对象是通过形参的方式传入函数的，直接赋值会改变形参的引用，但并不能改变作用域外的值。所以应该将值以属性的方式赋进去，或者直接赋值给 module.exports 对象

#### c/c++模块编译

Node 会调用 process.dlopen()方法进行加载和执行。Node 架构下，dlopen()方法在 windows 和 Linux 平台下分别有不同实现。通过 libuv 兼容层进行了封装

#### JSON 文件的编译

通过 JSON.parse()把通过 fs 模块异步读取的内容传入，即可得到对象，然后将对象赋给模块对象的 exports，以供外部使用。一般对于配置文件，可以直接 require(),无需 fs 读取。

## 包和 NPM

### CommonJS 规范定义的包结构

- package.json：包描述文件
- bin ：存放可执行二进制文件
- lib：存放 JS 代码
- doc：存放文档
- test：存放单元测试代码

### CommonJS 和 NPM 的包描述文件

> 需要注意的是，CommonJS 规范的 package.json 字段和 NPM 所实现的 package.json 字段略微有些差别。NPM 在 CommonJS 的基础上添加了一些字段

#### 几个字段解释

- bin：一些包作者希望包可以作为命令行工具使用，配置好 bin 字段后，通过 npm install package_name -g 命令可以将脚本添加到执行路径中，之后可以在命令行中直接执行
- main：模板引入方法 require()在引入包时，会有限检查这个字段，并将其作为包中其余模块的入口
- devDependencies：一些模块只在开发时需要依赖
- engine：支持的 JavaScript 引擎列表，ejs，ppc，mips，jsc，node，v8 等

#### NPM 常用功能

- 安装依赖包：npm install
  > 全局模式并不是将一个模块包安装为一个全局包的意思，它并不意味着可以在任何地方通过 require()都能引用到它。实际上，全局安装时将一个包安装为全局可用的可执行命令，它根据包描述文件中的 bin 字段配置，将实际脚本链接到与 Node 可执行文件相同路径下（全局模式安装的所有模块宝都被安装进了一个统一的目录下，这个目录是`path.resolve(process.execPath,'..','..','lib','node_modules')`这里 process.execPath 是 node 的安装目录，由于环境变量的作用，在任何目录下执行 node 命令都会链接到 node 安装目录）
- 查看可用包：npm ls 分析出当前路径通过模块路径找到的所有包，并生成依赖树

#### NPM 的问题

每个人都可以向 npm 仓库发布包，导致包的质量良莠不齐，一个可靠的，优秀的包必须有良好的测试，良好的文档，良好的测试覆盖率，良好的编码规范等等
