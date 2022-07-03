---
title: Node中的Buffer
date: 2017-11-24 21:04:55
description: Buffer是什么？
---

Node不同于前端JavaScript，在前端只需做一些简单的字符串和DOM操作即可。而在后端，需要处理大量的图片，文件，以及操作数据库。需要处理大量的二进制数据，Buffer也就应运而生了。
<!--more-->

## Buffer结构

### 模块结构

Buffer模块性能部分由c++实现，而非性能的相关部分使用JavaScript实现。Buffer对象属于堆外内存，不是由V8分配的。Buffer在Node进程启动时就已经加载进来了，所以无需require

### Buffer对象

Buffer对象类似于数组，它的每一项是16进制的两位数（0-255），可以通过length属性访问Buffer对象的长度（返回字节数）。同时也可以像数组一样给Buffer对象的某一位赋值（取值）

### Buffer的内存分配

在c++层面申请内存，在JavaScript中分配内存。而为了高效的使用分配来的内存,Node使用slab机制（一种动态内存管理机制），slab就是一块申请好的固定大小的内存区域。Node以8kb来区分Buffer对象是大对象还是小对象。Buffer.poolSize = 8 * 1024。8kb也是每个slab的大小

#### 分配小对象

构建小对象的Buffer对象时，会去看当前处于分配的slab空间是否足够，如果够就把Buffer对象放进slab中，并且用Buffer对象的parent属性指向该slab，用offset来标记相对于slab的偏移。如果不够就构造一个新的slab。一个slab可能会分配给多个Buffer对象使用，只有这些对象在作用域内释放并都可以回收，slab的空间才会回收。

#### 分配大对象

如果需要构建超过8kb的Buffer对象，将会直接分配一个SlowBuffer对象作为slab单元，这个SlowBuffer对象呗这个大Buffer对象独占。

## Buffer转换

Buffer对象可以和字符串实现相互转换，但是要注意编码问题。对于不支持的编码可以通过第三方库来支持，比如iconv-lite

## Buffer拼接

```javascript
var fs = require('fs')
var rs = fs.createReadStream('test.md')
var data = ""
rs.on('data',function(chunk) {
    data += chunk
})
rs.on('end',function() {
    console.log(data)
})
```
需要注意的是data事件中的chunk就是Buffer对象。而data += chunk这句代码里隐藏了toString()操作，它其实等价于data = data.toString() + chunk.toString()。这在英文中是没有问题的，但是在中文的环境下可能就会有问题。因为中文是宽字节编码。
```javascript
var rs = fs.createReadStream("test.md",{highWaterMark:11})
```
上诉代码如果test.md中是中文的话，就会出现乱码问题。这里设置每次读取的Buffer长度为11个字节，但是每个中文字占有3个字节，多出来的就会显示为乱码。

可以通过设置编码来解决这个问题
```javasctipt
var rs = fs.createReadStream('text.md',{highWaterMark:11})
rs.setEncoding('utf8')
```
上诉代码输出不会出现乱码。原因是内部通过decoder对象来实现。data事件不再接收原始的Buffer对象，而是一个decoder对象，这个对象会把多出来的字节放到下一个对象上去。但是他只能处理utf8，base64和ucs-2/utf-16le三种编码。
更好的解决方案是用一个数组接收所有的buffer片段，最后合并成一个Buffer对象，然后转换成字符串
```javascript
var chunks = []
var size = 0
res.on('data',function(chunk) {
    chunks.push(chunk)
    size += chunk.length
})

res.on('end',function() {
    var buf = Buffer.concat(chunks,size)
    var str = buf.toString('utf8')
    console.log(str)
})
```

## Buffer与性能

Buffer在文件I/O和网络I/O运用广泛。在应用中通常会操作字符串，但是在网络传输过程中，都需要转换为Buffer，以二进制数据传输。
```javascript
var http = require('http')
var helloworld = ""
for(var i = 0; i < 1024*10; i++) {
    helloworld += 'a'
}
//helloworld = new Buffer(helloworld)
http.createServer(function(req,res) {
    res.writeHead(200)
    res.end(helloworld)
}).listen(8080)
```
上诉代码构造了一个10kb的字符串，然后发送给请求的客户端。实验可以证明将helloworld从字符串转化为Buffer对象性能好些。原因在于网络传输的是二进制，提前转化就无需每次请求都要转换一下。
在文件读取的时候hightWaterMark参数的设置也格外重要。越大性能越好。（新版Node去掉了这个属性）
